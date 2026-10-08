export const DATASET_FORMATS = ['json', 'xlsx'] as const;

export type DatasetFormat = (typeof DATASET_FORMATS)[number];

export const DATASET_MIME_TYPES: Readonly<Record<DatasetFormat, string>> = {
  json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export const DATASET_FILE_NAMES: Readonly<Record<DatasetFormat, string>> = {
  json: 'nasa-images.json',
  xlsx: 'nasa-images.xlsx',
};
