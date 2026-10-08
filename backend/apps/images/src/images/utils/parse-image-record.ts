import { isRecord } from '@app/common/type-guards';
import { KEYWORD_SEPARATOR } from '../../shared/constants/image-record-columns';
import type { ImageRecord } from '../../shared/models/image-record';

export type ParsedImageRecord =
  | { readonly ok: true; readonly record: ImageRecord }
  | {
      readonly ok: false;
      readonly position: number;
      readonly nasaId: string | null;
      readonly reason: string;
    };

const MAX_NASA_ID_LENGTH = 200;

class InvalidField extends Error {}

const requiredText = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new InvalidField(`${field} must be a non-empty string`);
  }
  return value.trim();
};

const optionalText = (value: unknown, field: string): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new InvalidField(`${field} must be a string or null`);
  return value.trim() === '' ? null : value;
};

const isoDate = (value: unknown): string => {
  const date =
    value instanceof Date ? value : typeof value === 'string' ? new Date(value) : new Date(NaN);
  if (Number.isNaN(date.getTime())) throw new InvalidField('dateCreated must be a valid date');
  return date.toISOString();
};

const keywordList = (value: unknown): readonly string[] => {
  if (value === undefined || value === null || value === '') return [];
  const items = typeof value === 'string' ? value.split(KEYWORD_SEPARATOR) : value;
  if (!Array.isArray(items) || !items.every((item) => typeof item === 'string')) {
    throw new InvalidField('keywords must be a list of strings');
  }
  return items.map((item) => item.trim()).filter((item) => item.length > 0);
};

const httpUrl = (value: unknown, field: string): string | null => {
  const text = optionalText(value, field);
  if (text === null) return null;
  const protocol = URL.parse(text)?.protocol;
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new InvalidField(`${field} must be an http(s) URL`);
  }
  return text;
};

export const parseImageRecord = (candidate: unknown, position: number): ParsedImageRecord => {
  if (!isRecord(candidate)) {
    return { ok: false, position, nasaId: null, reason: 'record must be an object' };
  }
  const rawId = candidate['nasaId'];
  const nasaId = typeof rawId === 'string' && rawId.trim() !== '' ? rawId.trim() : null;
  try {
    if (nasaId === null) throw new InvalidField('nasaId must be a non-empty string');
    if (nasaId.length > MAX_NASA_ID_LENGTH) {
      throw new InvalidField(`nasaId must be at most ${MAX_NASA_ID_LENGTH} characters`);
    }
    return {
      ok: true,
      record: {
        nasaId,
        title: requiredText(candidate['title'], 'title'),
        description: optionalText(candidate['description'], 'description'),
        dateCreated: isoDate(candidate['dateCreated']),
        center: optionalText(candidate['center'], 'center'),
        keywords: keywordList(candidate['keywords']),
        photographer: optionalText(candidate['photographer'], 'photographer'),
        thumbUrl: httpUrl(candidate['thumbUrl'], 'thumbUrl'),
        imageUrl: httpUrl(candidate['imageUrl'], 'imageUrl'),
      },
    };
  } catch (error) {
    if (!(error instanceof InvalidField)) throw error;
    return { ok: false, position, nasaId, reason: error.message };
  }
};
