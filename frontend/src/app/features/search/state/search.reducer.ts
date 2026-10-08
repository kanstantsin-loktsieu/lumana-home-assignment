import { createEntityAdapter } from '@ngrx/entity';
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { FIRST_PAGE, MAX_REACHABLE_RESULTS } from '../constants/search.constants';
import { SearchResultItem } from '../models/search-result';
import { SearchState } from '../models/search-state';
import { hasMorePages } from '../utils/pagination';
import { SearchApiActions } from './search.actions';

const resultsAdapter = createEntityAdapter<SearchResultItem>({
  selectId: (item) => item.nasaId,
});

const initialState: SearchState = resultsAdapter.getInitialState({
  query: '',
  lastLoadedPage: 0,
  totalHits: 0,
  status: 'idle',
  error: null,
  hasMore: false,
});

export const searchFeature = createFeature({
  name: 'search',
  reducer: createReducer(
    initialState,
    on(SearchApiActions.searchStarted, (state, { query }): SearchState =>
      resultsAdapter.removeAll({
        ...state,
        query,
        lastLoadedPage: 0,
        totalHits: 0,
        status: 'loading',
        error: null,
        hasMore: false,
      }),
    ),
    on(SearchApiActions.searchCleared, (): SearchState => initialState),
    on(SearchApiActions.nextPageStarted, (state, { query }): SearchState =>
      query === state.query ? { ...state, status: 'loadingMore', error: null } : state,
    ),
    on(
      SearchApiActions.pageLoaded,
      (state, { query, page, items, totalHits, fetchedCount }): SearchState => {
        // race guard: drop responses for an older query or an unexpected page.
        if (query !== state.query || page !== state.lastLoadedPage + 1) {
          return state;
        }
        const loadedState = {
          ...state,
          lastLoadedPage: page,
          totalHits,
          status: 'loaded' as const,
          error: null,
          hasMore: hasMorePages(page, fetchedCount, totalHits),
        };
        return page === FIRST_PAGE
          ? resultsAdapter.setAll(items, loadedState)
          : resultsAdapter.addMany(items, loadedState);
      },
    ),
    on(SearchApiActions.pageFailed, (state, { query, error }): SearchState => {
      if (query !== state.query) {
        return state;
      }
      if (error.kind === 'result-cap') {
        return { ...state, status: 'loaded', hasMore: false, error: null };
      }
      return { ...state, status: 'error', error };
    }),
  ),
  extraSelectors: ({
    selectSearchState,
    selectStatus,
    selectHasMore,
    selectLastLoadedPage,
    selectTotalHits,
  }) => {
    const { selectAll } = resultsAdapter.getSelectors();
    return {
      selectResults: createSelector(selectSearchState, selectAll),
      selectCanLoadMore: createSelector(
        selectHasMore,
        selectStatus,
        (hasMore, status) => hasMore && status === 'loaded',
      ),
      selectCanRetryNextPage: createSelector(
        selectHasMore,
        selectStatus,
        selectLastLoadedPage,
        (hasMore, status, lastLoadedPage) => hasMore && status === 'error' && lastLoadedPage > 0,
      ),
      selectIsCapped: createSelector(
        selectHasMore,
        selectStatus,
        selectTotalHits,
        (hasMore, status, totalHits) =>
          status === 'loaded' && !hasMore && totalHits > MAX_REACHABLE_RESULTS,
      ),
    };
  },
});
