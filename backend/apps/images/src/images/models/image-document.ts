// `_id` is the NASA id, so the built-in unique index is the import's idempotency key
export interface ImageDocument {
  readonly _id: string;
  readonly title: string;
  readonly description: string | null;
  readonly dateCreated: Date;
  readonly center: string | null;
  readonly keywords: readonly string[];
  readonly photographer: string | null;
  readonly thumbUrl: string | null;
  readonly imageUrl: string | null;
  readonly importedAt: Date;
}
