import { createWriteStream, type WriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { once } from 'node:events';
import { join, resolve } from 'node:path';
import { finished } from 'node:stream/promises';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ExcelJS from 'exceljs';
import { raceStreamError } from '@app/common/stream-error';
import {
  DATASET_FILE_NAMES,
  DATASET_FORMATS,
  type DatasetFormat,
} from '../shared/constants/dataset-formats';
import { IMAGE_RECORD_COLUMNS, KEYWORD_SEPARATOR } from '../shared/constants/image-record-columns';
import type { ImageRecord } from '../shared/models/image-record';
import type { Environment } from '../config/environment';

export interface DatasetFileInfo {
  readonly format: DatasetFormat;
  readonly fileName: string;
  readonly bytes: number;
}

export interface DatasetWriter {
  write(record: ImageRecord): Promise<void>;
  commit(): Promise<readonly DatasetFileInfo[]>;
  abort(): Promise<void>;
}

const EXCEL_CELL_LIMIT = 32_767;

const toSheetValue = (record: ImageRecord, key: keyof ImageRecord): string | null => {
  const value = record[key];
  if (Array.isArray(value)) return value.join(KEYWORD_SEPARATOR);
  if (typeof value === 'string' && value.length > EXCEL_CELL_LIMIT) {
    return `${value.slice(0, EXCEL_CELL_LIMIT - 1)}…`;
  }
  return value as string | null;
};

class DatasetFileWriter implements DatasetWriter {
  private readonly json: WriteStream;
  private readonly xlsx: WriteStream;
  private readonly workbook: ExcelJS.stream.xlsx.WorkbookWriter;
  private readonly sheet: ExcelJS.Worksheet;
  private queue: Promise<void> = Promise.resolve();
  private recordCount = 0;

  constructor(private readonly paths: Readonly<Record<DatasetFormat, string>>) {
    this.json = this.openTemp('json');
    this.xlsx = this.openTemp('xlsx');
    this.json.write('[');
    // inline strings, so the file can be read back as a stream without a shared-strings lookup
    this.workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: this.xlsx,
      useStyles: true,
      useSharedStrings: false,
    });
    this.sheet = this.workbook.addWorksheet('images', { views: [{ state: 'frozen', ySplit: 1 }] });
    this.sheet.columns = IMAGE_RECORD_COLUMNS.map(({ key, width }) => ({
      key,
      header: key,
      width,
    }));
    this.sheet.getRow(1).font = { bold: true };
  }

  // one queue, so records from concurrent pages never interleave
  write(record: ImageRecord): Promise<void> {
    const next = this.queue.then(() => this.append(record));
    this.queue = next.catch(() => undefined);
    return next;
  }

  // writes go to temp files renamed here, so a failed run keeps the previous dataset
  async commit(): Promise<readonly DatasetFileInfo[]> {
    await this.queue;
    this.throwIfFailed();
    this.json.end(this.recordCount === 0 ? ']\n' : '\n]\n');
    await finished(this.json);
    this.sheet.commit();
    // the ExcelJS writer only watches its stream for errors at the very end; an earlier one
    // would hang it
    await raceStreamError(this.workbook.commit(), this.xlsx);
    return Promise.all(
      DATASET_FORMATS.map(async (format) => {
        await rename(this.tempPath(format), this.paths[format]);
        const { size } = await stat(this.paths[format]);
        return { format, fileName: DATASET_FILE_NAMES[format], bytes: size };
      }),
    );
  }

  async abort(): Promise<void> {
    this.json.destroy();
    this.xlsx.destroy();
    await Promise.all(DATASET_FORMATS.map((format) => rm(this.tempPath(format), { force: true })));
  }

  private async append(record: ImageRecord): Promise<void> {
    this.throwIfFailed();
    const separator = this.recordCount === 0 ? '\n' : ',\n';
    this.recordCount++;
    if (!this.json.write(separator + JSON.stringify(record))) await once(this.json, 'drain');
    const row = Object.fromEntries(
      IMAGE_RECORD_COLUMNS.map(({ key }) => [key, toSheetValue(record, key)]),
    );
    this.sheet.addRow(row).commit();
  }

  private openTemp(format: DatasetFormat): WriteStream {
    const stream = createWriteStream(this.tempPath(format));
    // the error stays readable as `stream.errored`; without a listener it would crash the process
    stream.on('error', () => undefined);
    return stream;
  }

  private throwIfFailed(): void {
    const failure = this.json.errored ?? this.xlsx.errored;
    if (failure !== null) throw failure;
  }

  private tempPath(format: DatasetFormat): string {
    return `${this.paths[format]}.tmp`;
  }
}

@Injectable()
export class DatasetFiles {
  private readonly dataDir: string;

  constructor(config: ConfigService<Environment, true>) {
    this.dataDir = resolve(config.get('DATA_DIR', { infer: true }));
  }

  pathFor(format: DatasetFormat): string {
    return join(this.dataDir, DATASET_FILE_NAMES[format]);
  }

  async open(): Promise<DatasetWriter> {
    await mkdir(this.dataDir, { recursive: true });
    return new DatasetFileWriter({ json: this.pathFor('json'), xlsx: this.pathFor('xlsx') });
  }
}
