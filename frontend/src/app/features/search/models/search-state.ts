import { EntityState } from '@ngrx/entity';
import { SearchError, SearchResultItem } from './search-result';

export type SearchStatus = 'idle' | 'loading' | 'loadingMore' | 'loaded' | 'error';

export interface SearchState extends EntityState<SearchResultItem> {
  readonly query: string;
  // 1-based, 0 before the first page lands.
  readonly lastLoadedPage: number;
  readonly totalHits: number;
  readonly status: SearchStatus;
  readonly error: SearchError | null;
  readonly hasMore: boolean;
}
