import { BadRequestException } from '@nestjs/common';

export interface DateRange {
  readonly from?: Date;
  readonly to?: Date;
}

// `@IsISO8601()` also accepts week, ordinal and basic forms (`2026-W41`) that `Date` cannot parse
const parseDate = (text: string | undefined, name: string): Date | undefined => {
  if (text === undefined) return undefined;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(
      `\`${name}\` must be an ISO 8601 date-time such as 2026-10-08T10:00:00Z`,
    );
  }
  return date;
};

export const parseDateRange = (from: string | undefined, to: string | undefined): DateRange => {
  const range = { from: parseDate(from, 'from'), to: parseDate(to, 'to') };
  if (range.from !== undefined && range.to !== undefined && range.from >= range.to) {
    throw new BadRequestException('`from` must be before `to`');
  }
  return range;
};
