export interface SearchResultItem {
  readonly nasaId: string;
  readonly title: string;
  readonly dateCreated: string;
  readonly center: string | null;
  readonly thumbUrl: string;
  readonly imageUrl: string;
  readonly imageWidth: number | null;
  readonly imageHeight: number | null;
}

export interface SearchPage {
  readonly items: SearchResultItem[];
  readonly totalHits: number;
  readonly fetchedCount: number;
}

export type SearchErrorKind = 'network' | 'result-cap' | 'http';

export interface SearchError {
  readonly kind: SearchErrorKind;
  readonly status: number;
  readonly message: string;
}
