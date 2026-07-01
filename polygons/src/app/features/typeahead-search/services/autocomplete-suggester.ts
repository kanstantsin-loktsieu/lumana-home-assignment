import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AutocompleteSuggester {
  // this is intentionally synchronous because there is no backend
  getSuggestions(query: string): string[] {
    return ['sugg1', 'sugg2', 'sugg3'];
  };
}
