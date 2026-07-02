import { Component, signal } from '@angular/core';
import { Search } from "./features/typeahead-search/components/search/search";
import { ResultsTable } from "./features/results-table/components/results-table/results-table";

@Component({
  selector: 'app-root',
  imports: [Search, ResultsTable],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly title = signal('polygons');
}
