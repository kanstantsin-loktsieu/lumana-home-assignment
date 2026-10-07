import { Component, computed, input, model, output, viewChild } from '@angular/core';
import { FormValueControl, ValidationError } from '@angular/forms/signals';
import {
  MatAutocomplete,
  MatAutocompleteSelectedEvent,
  MatAutocompleteTrigger,
  MatOptgroup,
  MatOption,
} from '@angular/material/autocomplete';
import { MatIconButton } from '@angular/material/button';
import {
  MatFormField,
  MatHint,
  MatLabel,
  MatPrefix,
  MatSuffix,
} from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { Suggestion } from '../../../models/suggestion';

/**
 * Presentational typeahead input, usable as a signal-forms control (`[formField]`). It only shows
 * its value, validation errors and the suggestions it is given; the parent owns the store logic.
 */
@Component({
  selector: 'app-search-box',
  imports: [
    MatFormField,
    MatLabel,
    MatHint,
    MatPrefix,
    MatSuffix,
    MatInput,
    MatIcon,
    MatIconButton,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatOption,
    MatOptgroup,
  ],
  templateUrl: './search-box.html',
  styleUrl: './search-box.scss',
})
export class SearchBox implements FormValueControl<string> {
  readonly value = model('');
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  readonly suggestions = input<readonly Suggestion[]>([]);

  readonly suggestionPicked = output<string>();

  private readonly matInput = viewChild.required(MatInput);
  private readonly autocompleteTrigger = viewChild.required(MatAutocompleteTrigger);

  protected readonly isEmpty = computed(() => this.value().trim() === '');
  protected readonly firstErrorMessage = computed(() => this.errors()[0]?.message ?? null);

  /** Re-anchors an open suggestions panel after the search box has moved. */
  repositionPanel(): void {
    const trigger = this.autocompleteTrigger();
    if (trigger.panelOpen) {
      trigger.updatePosition();
    }
  }

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected pick(event: MatAutocompleteSelectedEvent): void {
    const query = String(event.option.value);
    this.value.set(query);
    this.suggestionPicked.emit(query);
  }

  /** The clear button disappears once the field is empty, so focus goes back to the input. */
  protected clear(): void {
    this.value.set('');
    this.matInput().focus();
  }
}
