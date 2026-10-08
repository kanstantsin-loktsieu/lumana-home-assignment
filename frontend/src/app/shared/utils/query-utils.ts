import { TokenWithOffset } from '../models/token-with-offset';

export const normalizeQuery = (raw: string): string =>
  raw.trim().replace(/\s+/g, ' ').toLowerCase();

const TOKEN = /[\p{L}\p{N}]+/gu;

export const tokenize = (normalized: string): string[] => [
  ...new Set(normalized.match(TOKEN) ?? []),
];

export const tokenizeWithOffsets = (text: string): TokenWithOffset[] =>
  [...text.matchAll(TOKEN)].map((match) => ({
    token: match[0].toLowerCase(),
    start: match.index,
    end: match.index + match[0].length,
  }));
