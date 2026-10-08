const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const LARGEST_BUCKET_MS = 12 * HOUR_MS;

// the largest size covers the longest allowed range, the retention, in `MAX_BUCKETS` points
const BUCKET_SIZES_MS: readonly number[] = [
  MINUTE_MS,
  5 * MINUTE_MS,
  15 * MINUTE_MS,
  30 * MINUTE_MS,
  HOUR_MS,
  3 * HOUR_MS,
  6 * HOUR_MS,
  LARGEST_BUCKET_MS,
];

// more points would make the charts unreadable
const MAX_BUCKETS = 60;

export const pickBucketMs = (fromMs: number, toMs: number): number =>
  BUCKET_SIZES_MS.find((size) => (toMs - fromMs) / size <= MAX_BUCKETS) ?? LARGEST_BUCKET_MS;
