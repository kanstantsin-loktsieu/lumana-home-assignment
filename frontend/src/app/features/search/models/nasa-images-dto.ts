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
  readonly rel: 'preview' | 'alternate' | 'canonical' | string;
  readonly render?: string;
  readonly width?: number;
  readonly height?: number;
  readonly size?: number;
}

export interface NasaErrorBodyDto {
  readonly reason: string;
}
