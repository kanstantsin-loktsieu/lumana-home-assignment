import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { SearchError, SearchResultItem } from '../models/search-result';

export const SearchPageActions = createActionGroup({
  source: 'Search Page',
  events: {
    'Query Changed': props<{ query: string }>(),
    'Suggestion Picked': props<{ query: string }>(),
    'Next Page Requested': emptyProps(),
    'Retry Requested': emptyProps(),
  },
});

export const SearchApiActions = createActionGroup({
  source: 'NASA Search API',
  events: {
    'Search Started': props<{ query: string }>(),
    'Search Cleared': emptyProps(),
    'Next Page Started': props<{ query: string; page: number }>(),
    'Page Loaded': props<{
      query: string;
      page: number;
      items: SearchResultItem[];
      totalHits: number;
      fetchedCount: number;
      loadedAt: number;
    }>(),
    'Page Failed': props<{ query: string; page: number; error: SearchError }>(),
  },
});
