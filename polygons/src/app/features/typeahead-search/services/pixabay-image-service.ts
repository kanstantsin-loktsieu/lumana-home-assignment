import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { SearchResult } from '../../../core/model/search-result';

export interface PixabayResponse {
  total: number,
  totalHits: number,
  hits: SearchResult[],
};

@Injectable({
  providedIn: 'root',
})
export class PixabayImageService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://pixabay.com/api/';
  private readonly apiKey = '56523466-894d803afefc99b3826c6aed4';

  searchImages(query: string, page: number = 1) {
    return this.http.get<PixabayResponse>(this.baseUrl, {
      params: new HttpParams()
        .set('key', this.apiKey)
        .set('q', query)
        .set('page', `${page}`)
        .set('per_page', '20')
    });
  }
}
