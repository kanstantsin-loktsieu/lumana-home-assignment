export const PAGE_SIZE = 50;
// the nasa images API rejects any request with `page * page_size > 10000`.
export const MAX_REACHABLE_RESULTS = 10_000;
// nasa images API result pages are 1-based.
export const FIRST_PAGE = 1;
