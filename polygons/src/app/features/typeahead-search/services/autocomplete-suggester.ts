import { inject, Injectable } from '@angular/core';
import { PreviousQueriesStore } from '../../../store/previous-queries/store';

@Injectable({
  providedIn: 'root',
})
export class AutocompleteSuggester {
  private readonly previousQueriesStore = inject(PreviousQueriesStore);

  getSuggestions(query: string): string[] {
    return this.previousQueriesStore.queries().filter(q => q.includes(query) && (q !== query));
  };
}
