export interface ImageRecord {
  readonly nasaId: string;
  readonly title: string;
  readonly description: string | null;
  readonly dateCreated: string;
  readonly center: string | null;
  readonly keywords: readonly string[];
  readonly photographer: string | null;
  readonly thumbUrl: string | null;
  readonly imageUrl: string | null;
}
