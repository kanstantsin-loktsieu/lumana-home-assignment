import { normalizeQuery, tokenize } from '../../../shared/utils/query-utils';

// the NASA search matches whole words, not prefixes: `a` returns the whole library and `m`
// matches stray "M" tokens. one-character queries are noise, so nothing is requested below two
// characters.
const MIN_QUERY_LENGTH = 2;

// punctuation is not counted, so `--` or `a.` (which match the whole library) are never sent.
export const isSearchableQuery = (normalized: string): boolean =>
  tokenize(normalized).join('').length >= MIN_QUERY_LENGTH;

export const queryTooShortError = (rawQuery: string) => {
  const normalized = normalizeQuery(rawQuery);
  return normalized && !isSearchableQuery(normalized)
    ? { kind: 'queryTooShort', message: `Type at least ${MIN_QUERY_LENGTH} letters or digits` }
    : null;
};
