import { Component, inject, resource, signal, viewChild } from '@angular/core';
import { Search } from "./features/typeahead-search/components/search/search";
import { ResultsTable } from "./features/results-table/components/results-table/results-table";
import { PixabayImageService } from './features/typeahead-search/services/pixabay-image-service';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  imports: [Search, ResultsTable],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly imageService = inject(PixabayImageService);
  
  readonly title = signal('polygons');
  readonly searchResults = resource({
    defaultValue: { total: 0, totalHits: 0, hits: [] },
    params: () => ({
      query: this.searchComponent()?.debouncedQuery() ?? '',
      page: 1
    }),
    loader: ({ params }) => firstValueFrom(this.imageService.searchImages(params.query, params.page))
  });

  private readonly searchComponent = viewChild(Search);
}
