import { TokenWithOffset } from '../models/token-with-offset';

/** Trims, collapses whitespace and lowercases. The NASA search is case-insensitive. */
export const normalizeQuery = (raw: string): string =>
  raw.trim().replace(/\s+/g, ' ').toLowerCase();

const TOKEN = /[\p{L}\p{N}]+/gu;

/** Word breakdown of an already normalized string: unique letter/number runs, in order. */
export const tokenize = (normalized: string): string[] => [
  ...new Set(normalized.match(TOKEN) ?? []),
];

/** Tokens with their positions in `text`, used to highlight matches. Case-insensitive. */
export const tokenizeWithOffsets = (text: string): TokenWithOffset[] =>
  [...text.matchAll(TOKEN)].map((match) => ({
    token: match[0].toLowerCase(),
    start: match.index,
    end: match.index + match[0].length,
  }));
