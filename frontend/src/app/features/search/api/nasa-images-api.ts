import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { PAGE_SIZE } from '../constants/search.constants';
import { NasaSearchResponseDto } from '../models/nasa-images-dto';
import { SearchPage } from '../models/search-result';
import { mapSearchResponse } from '../utils/nasa-images-mapper';
import { toSearchError } from '../utils/search-error';

const SEARCH_URL = 'https://images-api.nasa.gov/search';

@Service()
export class NasaImagesApi {
  private readonly http = inject(HttpClient);

  // "page" is 1-based
  searchImages(query: string, page: number): Observable<SearchPage> {
    const params = new HttpParams()
      .set('q', query)
      .set('media_type', 'image')
      .set('page', page)
      .set('page_size', PAGE_SIZE);
    return this.http.get<NasaSearchResponseDto>(SEARCH_URL, { params }).pipe(
      map(mapSearchResponse),
      catchError((error: unknown) => throwError(() => toSearchError(error))),
    );
  }
}
