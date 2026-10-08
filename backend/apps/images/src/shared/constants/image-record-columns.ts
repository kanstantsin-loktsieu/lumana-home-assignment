import type { ImageRecord } from '../models/image-record';

export interface ImageRecordColumn {
  // also the header text the reader matches columns by
  readonly key: keyof ImageRecord;
  readonly width: number;
}

export const IMAGE_RECORD_COLUMNS: readonly ImageRecordColumn[] = [
  { key: 'nasaId', width: 24 },
  { key: 'title', width: 48 },
  { key: 'description', width: 80 },
  { key: 'dateCreated', width: 24 },
  { key: 'center', width: 10 },
  { key: 'keywords', width: 40 },
  { key: 'photographer', width: 24 },
  { key: 'thumbUrl', width: 60 },
  { key: 'imageUrl', width: 60 },
];

export const KEYWORD_SEPARATOR = '; ';
