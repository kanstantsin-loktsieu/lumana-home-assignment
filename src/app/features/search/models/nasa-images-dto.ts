/**
 * Raw response types of `GET https://images-api.nasa.gov/search`, as observed on the live API.
 * Everything that is not guaranteed on every item is optional.
 */
export interface NasaSearchResponseDto {
  readonly collection: {
    readonly href: string;
    readonly items: readonly NasaItemDto[];
    readonly metadata: { readonly total_hits: number };
    /** `http://` links that are emitted even on the last reachable page; never used to paginate. */
    readonly links?: readonly NasaCollectionLinkDto[];
  };
}

export interface NasaCollectionLinkDto {
  readonly rel: 'next' | 'prev' | string;
  readonly prompt?: string;
  readonly href: string;
}

export interface NasaItemDto {
  /** URL of the item's asset manifest (`collection.json`). */
  readonly href: string;
  readonly data: readonly NasaItemDataDto[];
  readonly links?: readonly NasaLinkDto[];
}

export interface NasaItemDataDto {
  readonly nasa_id: string;
  readonly title: string;
  readonly date_created: string;
  readonly media_type: string;
  readonly description?: string;
  readonly center?: string;
  readonly keywords?: readonly string[];
  readonly photographer?: string;
  readonly secondary_creator?: string;
}

export interface NasaLinkDto {
  readonly href: string;
  /** `preview` is the `~thumb`, `alternate` a `~small|~medium|~large`, `canonical` the `~orig`. */
  readonly rel: 'preview' | 'alternate' | 'canonical' | string;
  readonly render?: string;
  readonly width?: number;
  readonly height?: number;
  readonly size?: number;
}

/** Error body returned by the API on 4xx, e.g. past the 10 000-result cap. */
export interface NasaErrorBodyDto {
  readonly reason: string;
}
