import { extname } from 'node:path';
import type { Readable } from 'node:stream';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import busboy from 'busboy';
import type { Request } from 'express';
import { errorMessage } from '@app/common/error-message';
import { raceStreamError } from '@app/common/stream-error';
import { ActivityRecorder } from '../activity/activity-recorder';
import type { Environment } from '../config/environment';
import { DATASET_FORMATS } from '../shared/constants/dataset-formats';
import type { ImageRecord } from '../shared/models/image-record';
import {
  MAX_REPORTED_ERRORS,
  type ImportErrorDto,
  type ImportReportDto,
  type ImportStatus,
} from './dto/import-report';
import { ImagesRepository } from './images-repository';
import { ImportFormatError } from './parsers/import-format-error';
import { jsonImageRows } from './parsers/json-image-rows';
import { xlsxImageRows } from './parsers/xlsx-image-rows';
import { parseImageRecord } from './utils/parse-image-record';

class FileTooLargeError extends Error {}

interface Upload {
  readonly stream: Readable;
  readonly filename: string;
}

// mutable on purpose: one import owns it
class ImportTally {
  received = 0;
  valid = 0;
  rejected = 0;
  upserted = 0;
  modified = 0;
  unchanged = 0;
  failed = 0;
  rejectedSinceFlush = 0;
  readonly errors: ImportErrorDto[] = [];
  errorsTruncated = false;

  addError(error: ImportErrorDto): void {
    if (this.errors.length < MAX_REPORTED_ERRORS) this.errors.push(error);
    else this.errorsTruncated = true;
  }
}

// the XLSX reader would wait forever on a failed upload, so iteration ends as soon as it fails
async function* untilFailed<T>(rows: AsyncGenerator<T>, upload: Readable) {
  for (;;) {
    const next = await raceStreamError(rows.next(), upload);
    if (next.done) return;
    yield next.value;
  }
}

@Injectable()
export class ImageImporter {
  private readonly batchSize: number;
  private readonly maxFileBytes: number;

  constructor(
    config: ConfigService<Environment, true>,
    private readonly repository: ImagesRepository,
    private readonly recorder: ActivityRecorder,
  ) {
    this.batchSize = config.get('IMPORT_BATCH_SIZE', { infer: true });
    this.maxFileBytes = config.get('UPLOAD_MAX_MB', { infer: true }) * 2 ** 20;
  }

  // awaiting each batch is the backpressure: the upload is not read further while MongoDB writes
  async import(request: Request): Promise<ImportReportDto> {
    const upload = await this.receiveUpload(request);
    const extension = extname(upload.filename).toLowerCase();
    const format = DATASET_FORMATS.find((candidate) => extension === `.${candidate}`);
    if (format === undefined) {
      upload.stream.resume();
      throw new UnsupportedMediaTypeException('Upload a .json or .xlsx file');
    }

    let sizeExceeded = false;
    upload.stream.once('limit', () => {
      sizeExceeded = true;
      upload.stream.destroy(new FileTooLargeError());
    });
    // readableAborted also covers a client that sent everything but left before it was read
    request.once('close', () => {
      if (request.readableAborted) upload.stream.destroy(new Error('The client disconnected'));
    });

    const startedAt = performance.now();
    const importedAt = new Date();
    const tally = new ImportTally();
    let batch: ImageRecord[] = [];
    const report = (status: ImportStatus, abortReason?: string): ImportReportDto => ({
      status,
      format,
      received: tally.received,
      valid: tally.valid,
      rejected: tally.rejected,
      upserted: tally.upserted,
      modified: tally.modified,
      unchanged: tally.unchanged,
      failed: tally.failed,
      durationMs: Math.round(performance.now() - startedAt),
      ...(abortReason !== undefined && { abortReason }),
      errors: tally.errors,
      errorsTruncated: tally.errorsTruncated,
    });

    try {
      const rows = format === 'json' ? jsonImageRows(upload.stream) : xlsxImageRows(upload.stream);
      for await (const row of untilFailed(rows, upload.stream)) {
        const parsed = parseImageRecord(row, tally.received++);
        if (parsed.ok) {
          tally.valid++;
          batch.push(parsed.record);
        } else {
          tally.rejected++;
          tally.rejectedSinceFlush++;
          tally.addError({
            position: parsed.position,
            nasaId: parsed.nasaId,
            reason: parsed.reason,
          });
        }
        if (batch.length >= this.batchSize) {
          await this.flush(batch, importedAt, tally);
          batch = [];
        }
      }
      await this.flush(batch, importedAt, tally);
    } catch (error) {
      const unreadable = error instanceof ImportFormatError || upload.stream.errored !== null;
      if (!unreadable) {
        this.recorder.recordDomainEvent('images.import.failed', tally.received, { format });
        throw error;
      }
      upload.stream.resume();
      // records before the break are valid; keeping them is safe because the import is idempotent
      await this.flush(batch, importedAt, tally);
      const reason = sizeExceeded
        ? `File exceeds the ${this.maxFileBytes / 2 ** 20} MB upload limit`
        : errorMessage(error);
      this.recorder.recordDomainEvent('images.import.failed', tally.received, { format, reason });
      throw new HttpException(
        report('aborted', reason),
        sizeExceeded ? HttpStatus.PAYLOAD_TOO_LARGE : HttpStatus.BAD_REQUEST,
      );
    }

    this.recorder.recordDomainEvent('images.import.completed', tally.received, {
      format,
      upserted: tally.upserted,
      rejected: tally.rejected,
    });
    return report('completed');
  }

  private receiveUpload(request: Request): Promise<Upload> {
    let parser: busboy.Busboy;
    try {
      parser = busboy({
        headers: request.headers,
        limits: { files: 1, fields: 0, fileSize: this.maxFileBytes },
      });
    } catch {
      throw new BadRequestException('Expected a multipart/form-data body with a "file" part');
    }
    return new Promise((resolve, reject) => {
      parser.on('file', (name, stream, info) => {
        // busboy reports a cut-off body, the size limit and a client disconnect by destroying the
        // file stream with an error. without a listener from the start, it would crash the process.
        stream.on('error', () => undefined);
        if (name === 'file') resolve({ stream, filename: info.filename });
        else stream.resume();
      });
      parser.once('close', () => reject(new BadRequestException('The "file" part is missing')));
      parser.on('error', (error) =>
        reject(new BadRequestException(`Malformed multipart body: ${errorMessage(error)}`)),
      );
      request.pipe(parser);
    });
  }

  private async flush(batch: readonly ImageRecord[], importedAt: Date, tally: ImportTally) {
    if (batch.length > 0) {
      const result = await this.repository.upsertBatch(batch, importedAt);
      tally.upserted += result.upserted;
      tally.modified += result.modified;
      tally.unchanged += result.matched - result.modified;
      tally.failed += result.failed.length;
      for (const failure of result.failed) tally.addError({ position: null, ...failure });
      this.recorder.recordDomainEvent('images.batch.upserted', result.upserted + result.modified, {
        batchSize: batch.length,
      });
    }
    if (tally.rejectedSinceFlush > 0) {
      this.recorder.recordDomainEvent('images.records.rejected', tally.rejectedSinceFlush);
      tally.rejectedSinceFlush = 0;
    }
  }
}
