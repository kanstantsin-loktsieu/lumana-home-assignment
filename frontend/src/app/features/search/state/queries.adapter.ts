import { createEntityAdapter } from '@ngrx/entity';
import { SavedQuery } from '../models/saved-query';

export const queriesAdapter = createEntityAdapter<SavedQuery>({
  sortComparer: (a, b) => b.lastUsedAt - a.lastUsedAt || a.id.localeCompare(b.id),
});
