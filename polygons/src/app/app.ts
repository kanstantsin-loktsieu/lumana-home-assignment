import { Component, signal } from '@angular/core';
import { Search } from "./features/typeahead-search/components/search/search";

@Component({
  selector: 'app-root',
  imports: [Search],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly title = signal('polygons');
}
