import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Action, Store } from '@ngrx/store';
import {
  Observable,
  catchError,
  debounce,
  distinctUntilChanged,
  exhaustMap,
  filter,
  map,
  merge,
  of,
  startWith,
  switchMap,
  takeUntil,
  timer,
} from 'rxjs';
import { normalizeQuery } from '../../../shared/utils/query-utils';
import { NasaImagesApi } from '../api/nasa-images-api';
import { FIRST_PAGE } from '../constants/search.constants';
import { SearchError } from '../models/search-result';
import { isSearchableQuery } from '../utils/searchable-query';
import { SearchApiActions, SearchPageActions } from './search.actions';
import { searchFeature } from './search.reducer';

const TYPEAHEAD_DEBOUNCE_MS = 300;

const fetchPage = (api: NasaImagesApi, query: string, page: number): Observable<Action> =>
  api.searchImages(query, page).pipe(
    map((result) => SearchApiActions.pageLoaded({ query, page, ...result, loadedAt: Date.now() })),
    catchError((error: SearchError) => of(SearchApiActions.pageFailed({ query, page, error }))),
  );

// `switchMap` cancels the previous request, which aborts the underlying fetch. retrying a failed
// first page re-runs the query and bypasses the distinct check on purpose.
export const searchOnQueryChange = createEffect(
  (actions$ = inject(Actions), store = inject(Store), api = inject(NasaImagesApi)) => {
    // clearing the box is not typing: an empty query skips the debounce, so the list clears at once.
    const typed$ = actions$.pipe(
      ofType(SearchPageActions.queryChanged),
      debounce(({ query }) => timer(normalizeQuery(query) ? TYPEAHEAD_DEBOUNCE_MS : 0)),
    );
    const picked$ = actions$.pipe(ofType(SearchPageActions.suggestionPicked));
    const query$ = merge(typed$, picked$).pipe(
      map(({ query }) => normalizeQuery(query)),
      distinctUntilChanged(),
    );
    const retry$ = actions$.pipe(
      ofType(SearchPageActions.retryRequested),
      concatLatestFrom(() => [
        store.select(searchFeature.selectQuery),
        store.select(searchFeature.selectLastLoadedPage),
      ]),
      filter(([, , lastLoadedPage]) => lastLoadedPage === 0),
      map(([, query]) => query),
    );

    return merge(query$, retry$).pipe(
      switchMap((query) =>
        isSearchableQuery(query)
          ? fetchPage(api, query, FIRST_PAGE).pipe(
              startWith(SearchApiActions.searchStarted({ query })),
            )
          : of(SearchApiActions.searchCleared()),
      ),
    );
  },
  { functional: true },
);

// a failed page is retried only by an explicit retry, never automatically. `exhaustMap` ignores
// duplicates while a page is in flight, and `takeUntil` aborts the request as soon as a new query
// starts or the search is cleared.
export const loadNextPage = createEffect(
  (actions$ = inject(Actions), store = inject(Store), api = inject(NasaImagesApi)) => {
    const scrolled$ = actions$.pipe(
      ofType(SearchPageActions.nextPageRequested),
      concatLatestFrom(() => store.select(searchFeature.selectCanLoadMore)),
      filter(([, canLoadMore]) => canLoadMore),
    );
    const retried$ = actions$.pipe(
      ofType(SearchPageActions.retryRequested),
      concatLatestFrom(() => store.select(searchFeature.selectCanRetryNextPage)),
      filter(([, canRetry]) => canRetry),
    );
    return merge(scrolled$, retried$).pipe(
      concatLatestFrom(() => [
        store.select(searchFeature.selectQuery),
        store.select(searchFeature.selectLastLoadedPage),
      ]),
      exhaustMap(([, query, lastLoadedPage]) =>
        fetchPage(api, query, lastLoadedPage + 1).pipe(
          startWith(SearchApiActions.nextPageStarted({ query, page: lastLoadedPage + 1 })),
          takeUntil(
            actions$.pipe(ofType(SearchApiActions.searchStarted, SearchApiActions.searchCleared)),
          ),
        ),
      ),
    );
  },
  { functional: true },
);
