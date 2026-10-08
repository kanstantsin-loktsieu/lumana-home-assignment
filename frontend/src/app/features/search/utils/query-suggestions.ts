import { normalizeQuery, tokenize, tokenizeWithOffsets } from '../../../shared/utils/query-utils';
import { IndexedQuery } from '../models/saved-query';
import { Suggestion, SuggestionSegment } from '../models/suggestion';

const RECENT_SUGGESTIONS = 5;
const MAX_SUGGESTIONS = 8;

/** Splits `text` into highlighted / plain segments: each word gets its longest matching input-token prefix marked. */
const highlightSegments = (text: string, inputTokens: readonly string[]): SuggestionSegment[] => {
  const segments: SuggestionSegment[] = [];
  let emittedUpTo = 0;
  for (const { token, start, end } of tokenizeWithOffsets(text)) {
    const matchLength = inputTokens.reduce(
      (best, inputToken) =>
        token.startsWith(inputToken) && inputToken.length > best ? inputToken.length : best,
      0,
    );
    if (matchLength === 0) {
      continue;
    }
    if (start > emittedUpTo) {
      segments.push({ text: text.slice(emittedUpTo, start), match: false });
    }
    segments.push({ text: text.slice(start, start + matchLength), match: true });
    emittedUpTo = start + matchLength;
    if (end > emittedUpTo) {
      segments.push({ text: text.slice(emittedUpTo, end), match: false });
      emittedUpTo = end;
    }
  }
  if (emittedUpTo < text.length) {
    segments.push({ text: text.slice(emittedUpTo), match: false });
  }
  return segments;
};

const unhighlighted = (text: string): Suggestion => ({
  id: text,
  text,
  highlightedSegments: [{ text, match: false }],
});

/**
 * Suggests past queries by word breakdown: an input token matches when it is a prefix of any word
 * of a saved query, in any order ("11 apo" → "apollo 11"). Ranked by matched-token count, then
 * usage, then recency. An empty input lists the most recent queries.
 */
export const rankSuggestions = (
  queryIndex: readonly IndexedQuery[],
  rawInput: string,
  limit = MAX_SUGGESTIONS,
): Suggestion[] => {
  const input = normalizeQuery(rawInput);
  if (!input) {
    return queryIndex.slice(0, RECENT_SUGGESTIONS).map(({ query }) => unhighlighted(query.id));
  }
  const inputTokens = tokenize(input);
  if (inputTokens.length === 0) {
    return [];
  }
  return queryIndex
    .map((entry) => ({
      entry,
      matched: inputTokens.filter((inputToken) =>
        entry.tokens.some((token) => token.startsWith(inputToken)),
      ).length,
    }))
    .filter(({ entry, matched }) => matched > 0 && entry.query.id !== input)
    .sort(
      (a, b) =>
        b.matched - a.matched ||
        b.entry.query.usageCount - a.entry.query.usageCount ||
        b.entry.query.lastUsedAt - a.entry.query.lastUsedAt,
    )
    .slice(0, limit)
    .map(({ entry }) => ({
      id: entry.query.id,
      text: entry.query.id,
      highlightedSegments: highlightSegments(entry.query.id, inputTokens),
    }));
};
