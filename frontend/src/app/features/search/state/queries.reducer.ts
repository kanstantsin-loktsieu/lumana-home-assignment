import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { tokenize } from '../../../shared/utils/query-utils';
import { FIRST_PAGE } from '../constants/search.constants';
import { IndexedQuery, QueriesState } from '../models/saved-query';
import { rememberQuery } from '../utils/query-history';
import { queriesAdapter } from './queries.adapter';
import { SearchApiActions } from './search.actions';

const initialState: QueriesState = queriesAdapter.getInitialState();

export const queriesFeature = createFeature({
  name: 'queries',
  reducer: createReducer(
    initialState,
    on(SearchApiActions.pageLoaded, (state, { query, page, totalHits, loadedAt }) =>
      page === FIRST_PAGE && totalHits > 0 ? rememberQuery(state, query, loadedAt) : state,
    ),
  ),
  extraSelectors: ({ selectQueriesState }) => {
    const selectSavedQueries = createSelector(
      selectQueriesState,
      queriesAdapter.getSelectors().selectAll,
    );
    return {
      selectSavedQueries,
      selectQueryIndex: createSelector(selectSavedQueries, (queries): IndexedQuery[] =>
        queries.map((query) => ({ query, tokens: tokenize(query.id) })),
      ),
    };
  },
});
