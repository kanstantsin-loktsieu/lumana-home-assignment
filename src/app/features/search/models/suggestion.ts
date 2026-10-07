export interface SuggestionSegment {
  readonly text: string;
  readonly match: boolean;
}

export interface Suggestion {
  readonly id: string;
  readonly text: string;
  readonly highlightedSegments: readonly SuggestionSegment[];
}
