import { QueriesState } from '../models/saved-query';
import { queriesAdapter } from '../state/queries.adapter';

const MAX_SAVED_QUERIES = 100;

// every meaningful query is kept, including ones that are prefixes or substrings of others
// ("apol" and "apollo" are both saved).
export const rememberQuery = (
  state: QueriesState,
  normalizedQuery: string,
  usedAt: number,
): QueriesState => {
  const existingQuery = state.entities[normalizedQuery];
  if (existingQuery) {
    return queriesAdapter.updateOne(
      {
        id: normalizedQuery,
        changes: { usageCount: existingQuery.usageCount + 1, lastUsedAt: usedAt },
      },
      state,
    );
  }
  const stateWithQuery = queriesAdapter.addOne(
    { id: normalizedQuery, usageCount: 1, lastUsedAt: usedAt },
    state,
  );
  // `ids` are kept sorted by recency (sortComparer), so the overflow is at the end.
  const overflow = (stateWithQuery.ids as string[]).slice(MAX_SAVED_QUERIES);
  return overflow.length ? queriesAdapter.removeMany(overflow, stateWithQuery) : stateWithQuery;
};
