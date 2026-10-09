// a date-time without a zone would be read in the process's local time zone, so only a plain date
// (UTC midnight) or a date-time with `Z` or an offset is accepted
const ZONED_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/i;

export const ZONED_DATE_HINT =
  'a date (2026-10-08) or a date-time with a zone (2026-10-08T10:00:00Z)';

export const parseZonedDate = (text: string): Date | null => {
  if (!ZONED_DATE.test(text.trim())) return null;
  const date = new Date(text.trim());
  return Number.isNaN(date.getTime()) ? null : date;
};
