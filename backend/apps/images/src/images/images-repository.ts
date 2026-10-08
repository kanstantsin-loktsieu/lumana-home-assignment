import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import {
  MongoBulkWriteError,
  type AnyBulkWriteOperation,
  type Collection,
  type Db,
  type Filter,
} from 'mongodb';
import {
  dateRangeFilter,
  findKeysetPage,
  type CursorPage,
  type KeysetCursor,
} from '@app/mongo/keyset-cursor';
import { MONGO_DB } from '@app/mongo/mongo-tokens';
import type { ImageRecord } from '../shared/models/image-record';
import type { ImageDocument } from './models/image-document';
import { toImageFields, toImageRecord } from './utils/image-document-mapper';

export interface RecordFailure {
  readonly nasaId: string;
  readonly reason: string;
}

export interface UpsertResult {
  readonly upserted: number;
  readonly modified: number;
  readonly matched: number;
  readonly failed: readonly RecordFailure[];
}

export interface ImageSearch {
  readonly q?: string;
  readonly center?: string;
  readonly keyword?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly limit: number;
  readonly cursor: KeysetCursor | null;
}

@Injectable()
export class ImagesRepository implements OnModuleInit {
  private readonly collection: Collection<ImageDocument>;

  constructor(@Inject(MONGO_DB) db: Db) {
    this.collection = db.collection<ImageDocument>('images');
  }

  async onModuleInit(): Promise<void> {
    await this.collection.createIndexes([
      {
        key: { title: 'text', keywords: 'text', description: 'text' },
        name: 'images_text',
        weights: { title: 10, keywords: 5, description: 1 },
      },
      { key: { dateCreated: -1, _id: -1 }, name: 'dateCreated_desc' },
      { key: { center: 1, dateCreated: -1, _id: -1 }, name: 'center_dateCreated_desc' },
      { key: { keywords: 1, dateCreated: -1, _id: -1 }, name: 'keywords_dateCreated_desc' },
    ]);
  }

  // `$set` holds only record fields, so re-importing unchanged data modifies nothing. per-document
  // write errors are reported rather than thrown, so one bad record does not fail the batch.
  async upsertBatch(records: readonly ImageRecord[], importedAt: Date): Promise<UpsertResult> {
    // one unordered bulk must not upsert the same _id twice; the last occurrence wins
    const unique = [...new Map(records.map((record) => [record.nasaId, record])).values()];
    const operations: AnyBulkWriteOperation<ImageDocument>[] = unique.map((record) => ({
      updateOne: {
        filter: { _id: record.nasaId },
        update: { $set: toImageFields(record), $setOnInsert: { importedAt } },
        upsert: true,
      },
    }));
    try {
      const result = await this.collection.bulkWrite(operations, { ordered: false });
      return {
        upserted: result.upsertedCount,
        modified: result.modifiedCount,
        matched: result.matchedCount,
        failed: [],
      };
    } catch (error) {
      if (!(error instanceof MongoBulkWriteError)) throw error;
      const writeErrors = Array.isArray(error.writeErrors)
        ? error.writeErrors
        : [error.writeErrors];
      return {
        upserted: error.result.upsertedCount,
        modified: error.result.modifiedCount,
        matched: error.result.matchedCount,
        failed: writeErrors.map((writeError) => ({
          nasaId: unique[writeError.index]?.nasaId ?? 'unknown',
          reason: writeError.errmsg ?? `write error ${writeError.code}`,
        })),
      };
    }
  }

  // with `q` the text index only filters: a keyset cursor over the relevance score is not stable
  async search(search: ImageSearch): Promise<CursorPage<ImageRecord>> {
    const { q, center, keyword, from, to, limit, cursor } = search;
    const filter: Filter<ImageDocument> = {
      ...(q !== undefined && { $text: { $search: q } }),
      ...(center !== undefined && { center }),
      ...(keyword !== undefined && { keywords: keyword }),
      ...dateRangeFilter('dateCreated', from, to),
    };
    const page = await findKeysetPage(this.collection, {
      filter,
      sortField: 'dateCreated',
      limit,
      cursor,
    });
    return { items: page.items.map(toImageRecord), nextCursor: page.nextCursor };
  }
}
