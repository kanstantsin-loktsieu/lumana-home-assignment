export type ImageRendition = 'large' | 'medium' | 'small' | 'thumb';

export interface ImageLink {
  readonly href: string;
  readonly width: number | null;
  readonly height: number | null;
}
