/** 50 results per page: measured ~0.4 s / 56 KB, the fewest round-trips before latency jumps. */
export const PAGE_SIZE = 50;

/** The API rejects any request with `page * page_size > 10000`. */
export const MAX_REACHABLE_RESULTS = 10_000;

/** NASA result pages are 1-based. */
export const FIRST_PAGE = 1;
