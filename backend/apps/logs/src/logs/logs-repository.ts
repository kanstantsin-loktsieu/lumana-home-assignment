import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { MongoServerError, type Collection, type Db, type Filter } from 'mongodb';
import type { ActivityEventKind } from '@app/activity/activity-event';
import {
  dateRangeFilter,
  findKeysetPage,
  type CursorPage,
  type KeysetCursor,
} from '@app/mongo/keyset-cursor';
import { MONGO_DB } from '@app/mongo/mongo-tokens';
import type { LogDto } from './dto/log-page';
import type { LogDocument, LogLevel } from './models/log-document';
import { toLogDto } from './utils/to-log-dto';

export interface LogQuery {
  readonly from?: Date;
  readonly to?: Date;
  readonly kind?: ActivityEventKind;
  readonly type?: string;
  readonly level?: LogLevel;
  readonly limit: number;
  readonly cursor: KeysetCursor | null;
}

export interface LogTypeCount {
  readonly type: string;
  readonly kind: ActivityEventKind;
  readonly count: number;
}

const DUPLICATE_KEY = 11000;

@Injectable()
export class LogsRepository implements OnModuleInit {
  private readonly collection: Collection<LogDocument>;

  constructor(@Inject(MONGO_DB) db: Db) {
    this.collection = db.collection<LogDocument>('logs');
  }

  // equality field first, then the sort, so every filter pages through an index
  async onModuleInit(): Promise<void> {
    await this.collection.createIndexes([
      { key: { occurredAt: -1, _id: -1 }, name: 'occurredAt_desc' },
      { key: { type: 1, occurredAt: -1, _id: -1 }, name: 'type_occurredAt_desc' },
      { key: { kind: 1, occurredAt: -1, _id: -1 }, name: 'kind_occurredAt_desc' },
      { key: { level: 1, occurredAt: -1, _id: -1 }, name: 'level_occurredAt_desc' },
    ]);
  }

  async insert(doc: LogDocument): Promise<void> {
    try {
      await this.collection.insertOne(doc);
    } catch (error) {
      if (error instanceof MongoServerError && error.code === DUPLICATE_KEY) return;
      throw error;
    }
  }

  async query(query: LogQuery): Promise<CursorPage<LogDto>> {
    const { from, to, kind, type, level, limit, cursor } = query;
    const filter: Filter<LogDocument> = {
      ...(kind !== undefined && { kind }),
      ...(type !== undefined && { type }),
      ...(level !== undefined && { level }),
      ...dateRangeFilter('occurredAt', from, to),
    };
    const page = await findKeysetPage(this.collection, {
      filter,
      sortField: 'occurredAt',
      limit,
      cursor,
    });
    return { items: page.items.map(toLogDto), nextCursor: page.nextCursor };
  }

  typeCounts(): Promise<LogTypeCount[]> {
    return this.collection
      .aggregate<LogTypeCount>([
        { $group: { _id: { type: '$type', kind: '$kind' }, count: { $sum: 1 } } },
        { $project: { _id: 0, type: '$_id.type', kind: '$_id.kind', count: 1 } },
        { $sort: { count: -1, type: 1 } },
      ])
      .toArray();
  }
}
