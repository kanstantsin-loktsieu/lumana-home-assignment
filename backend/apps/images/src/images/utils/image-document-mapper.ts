import type { ImageRecord } from '../../shared/models/image-record';
import type { ImageDocument } from '../models/image-document';

export type ImageFields = Omit<ImageDocument, '_id' | 'importedAt'>;

export const toImageFields = (record: ImageRecord): ImageFields => ({
  title: record.title,
  description: record.description,
  dateCreated: new Date(record.dateCreated),
  center: record.center,
  keywords: record.keywords,
  photographer: record.photographer,
  thumbUrl: record.thumbUrl,
  imageUrl: record.imageUrl,
});

export const toImageRecord = (doc: ImageDocument): ImageRecord => ({
  nasaId: doc._id,
  title: doc.title,
  description: doc.description,
  dateCreated: doc.dateCreated.toISOString(),
  center: doc.center,
  keywords: doc.keywords,
  photographer: doc.photographer,
  thumbUrl: doc.thumbUrl,
  imageUrl: doc.imageUrl,
});
