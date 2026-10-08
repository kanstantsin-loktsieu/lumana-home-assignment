import { MAX_REACHABLE_RESULTS, PAGE_SIZE } from '../constants/search.constants';

/**
 * Whether another page can be requested after `page`. `fetchedCount` is the raw API count, so
 * items dropped by the mapper don't end the list early; the API's 10 000-result cap ends it.
 */
export const hasMorePages = (page: number, fetchedCount: number, totalHits: number): boolean =>
  fetchedCount === PAGE_SIZE && page * PAGE_SIZE < Math.min(totalHits, MAX_REACHABLE_RESULTS);
