import type { Collection, Document, Filter, WithId } from 'mongodb';
import { isRecord } from '@app/common/type-guards';

export interface KeysetCursor {
  readonly sortValue: Date;
  readonly id: string;
}

export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

// only `Date` fields can be keyset sort keys
export type DateField<T> = { [K in keyof T]: T[K] extends Date ? K : never }[keyof T] & string;

export interface KeysetQuery<T> {
  readonly filter: Filter<T>;
  // `_id` is the tie-breaker, so equal values still page deterministically
  readonly sortField: DateField<T>;
  readonly limit: number;
  readonly cursor: KeysetCursor | null;
}

const encodeCursor = (cursor: KeysetCursor): string =>
  Buffer.from(JSON.stringify({ v: cursor.sortValue.toISOString(), id: cursor.id })).toString(
    'base64url',
  );

export const decodeCursor = (text: string): KeysetCursor | null => {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(text, 'base64url').toString('utf8'));
    if (!isRecord(parsed) || typeof parsed['v'] !== 'string' || typeof parsed['id'] !== 'string') {
      return null;
    }
    const sortValue = new Date(parsed['v']);
    return Number.isNaN(sortValue.getTime()) ? null : { sortValue, id: parsed['id'] };
  } catch {
    return null;
  }
};

const afterCursor = (field: string, cursor: KeysetCursor | null): Document =>
  cursor === null
    ? {}
    : {
        $or: [
          { [field]: { $lt: cursor.sortValue } },
          { [field]: cursor.sortValue, _id: { $lt: cursor.id } },
        ],
      };

export const dateRangeFilter = (field: string, from?: Date, to?: Date): Document =>
  from === undefined && to === undefined
    ? {}
    : {
        [field]: {
          ...(from !== undefined && { $gte: from }),
          ...(to !== undefined && { $lt: to }),
        },
      };

// reads `limit + 1` documents: the extra one only signals that another page exists, so no count
// or `skip` is needed
export const findKeysetPage = async <T extends { readonly _id: string }>(
  collection: Collection<T>,
  { filter, sortField, limit, cursor }: KeysetQuery<T>,
): Promise<CursorPage<WithId<T>>> => {
  const query: Filter<T> = { ...filter, ...afterCursor(sortField, cursor) };
  const docs = await collection
    .find(query)
    .sort({ [sortField]: -1, _id: -1 })
    .limit(limit + 1)
    .toArray();
  const items = docs.slice(0, limit);
  const last = items.at(-1);
  const fields: Record<string, unknown> | undefined = isRecord(last) ? last : undefined;
  const sortValue = fields?.[sortField];
  const nextCursor =
    docs.length > limit && last !== undefined && sortValue instanceof Date
      ? encodeCursor({ sortValue, id: last._id })
      : null;
  return { items, nextCursor };
};
