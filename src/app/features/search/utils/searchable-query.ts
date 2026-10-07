import { normalizeQuery, tokenize } from '../../../shared/utils/query-text';

/**
 * NASA search matches whole words, not prefixes: `a` returns the whole library and `m` matches
 * stray "M" tokens. One-character queries are noise, so nothing is requested below two characters.
 */
const MIN_QUERY_LENGTH = 2;

/**
 * Whether a normalized query is worth a request: at least `MIN_QUERY_LENGTH` letters or digits.
 * Punctuation is not counted, so `--` or `a.` (which match the whole library) are never sent.
 */
export const isSearchableQuery = (normalized: string): boolean =>
  tokenize(normalized).join('').length >= MIN_QUERY_LENGTH;

/** Signal-form validation error for input that is not empty but too short to be searched. */
export const queryTooShortError = (rawQuery: string) => {
  const normalized = normalizeQuery(rawQuery);
  return normalized && !isSearchableQuery(normalized)
    ? { kind: 'queryTooShort', message: `Type at least ${MIN_QUERY_LENGTH} letters or digits` }
    : null;
};
