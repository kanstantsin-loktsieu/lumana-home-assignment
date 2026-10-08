import { EntityState } from '@ngrx/entity';

export interface SavedQuery {
  readonly id: string;
  readonly usageCount: number;
  readonly lastUsedAt: number;
}

export interface IndexedQuery {
  readonly query: SavedQuery;
  readonly tokens: readonly string[];
}

export type QueriesState = EntityState<SavedQuery>;
