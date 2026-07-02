import { Component, computed, DestroyRef, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { AutocompleteSuggester } from '../../services/autocomplete-suggester';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-search',
  imports: [MatInputModule, FormsModule, MatDividerModule],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class Search {
  private readonly autocompleteSuggester = inject(AutocompleteSuggester);
  private readonly destroyRef = inject(DestroyRef);

  readonly query = signal('');
  readonly showSuggestions = linkedSignal(() => this.debouncedQuery().trim().length > 0);
  readonly suggestions = computed(() => this.autocompleteSuggester.getSuggestions(this.debouncedQuery()));

  // debounced() is still experimental
  private readonly debouncedQuery = toSignal(
    toObservable(this.query)
      .pipe(
        debounceTime(300),
        map(query => query.trim().toLowerCase()),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      ),
    { initialValue: '' }
  );
}
