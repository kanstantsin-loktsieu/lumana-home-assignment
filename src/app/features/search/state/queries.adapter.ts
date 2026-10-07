import { createEntityAdapter } from '@ngrx/entity';
import { SavedQuery } from '../models/saved-query';

/** Most recent first, which is what the empty-input "recent searches" list needs. */
export const queriesAdapter = createEntityAdapter<SavedQuery>({
  sortComparer: (a, b) => b.lastUsedAt - a.lastUsedAt || a.id.localeCompare(b.id),
});
