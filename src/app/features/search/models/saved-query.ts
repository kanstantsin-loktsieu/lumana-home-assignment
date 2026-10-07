import { EntityState } from '@ngrx/entity';

/** A meaningful past query. `id` is the normalized query text. */
export interface SavedQuery {
  readonly id: string;
  readonly usageCount: number;
  readonly lastUsedAt: number;
}

/** A saved query with its pre-computed word breakdown, used for suggestions. */
export interface IndexedQuery {
  readonly query: SavedQuery;
  readonly tokens: readonly string[];
}

export type QueriesState = EntityState<SavedQuery>;
