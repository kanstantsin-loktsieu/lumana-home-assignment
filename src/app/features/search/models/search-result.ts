/** One search hit, flattened from the NASA DTO into a serializable value for the store. */
export interface SearchResultItem {
  readonly nasaId: string;
  readonly title: string;
  readonly dateCreated: string;
  readonly center: string | null;
  readonly thumbUrl: string;
  /** Never the `~orig` rendition, which can be a huge PNG or a TIFF. */
  readonly imageUrl: string;
  readonly imageWidth: number | null;
  readonly imageHeight: number | null;
}

export interface SearchPage {
  readonly items: SearchResultItem[];
  readonly totalHits: number;
  /** Items the API returned before unusable ones were dropped; drives end-of-list detection. */
  readonly fetchedCount: number;
}

export type SearchErrorKind = 'network' | 'result-cap' | 'http';

export interface SearchError {
  readonly kind: SearchErrorKind;
  readonly status: number;
  readonly message: string;
}
