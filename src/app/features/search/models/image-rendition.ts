/**
 * NASA rendition suffixes (`~large.jpg`, …) that a browser can display at a sensible size. The
 * `~orig` rendition is deliberately not part of this type: it can be a 7776×11580 PNG or a TIFF.
 */
export type ImageRendition = 'large' | 'medium' | 'small' | 'thumb';

export interface ImageLink {
  readonly href: string;
  readonly width: number | null;
  readonly height: number | null;
}
