import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

type PreviousQueriesState = {
  queries: string[];
};

const initialState: PreviousQueriesState = {
  queries: ['sugg1', 'sugg2', 'abc'],
};

// TO DO: rewrite to classic store
export const PreviousQueriesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods(store => ({
    addQuery(query: string) {
      patchState(store, state => ({ queries: [...state.queries, query] }));
    },
  })),
);