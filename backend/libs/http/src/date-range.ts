import { BadRequestException } from '@nestjs/common';
import { parseZonedDate, ZONED_DATE_HINT } from '@app/common/zoned-date';

export interface DateRange {
  readonly from?: Date;
  readonly to?: Date;
}

// `@IsISO8601()` also accepts week dates (`2026-W41`) and date-times without a zone
const parseDate = (text: string | undefined, name: string): Date | undefined => {
  if (text === undefined) return undefined;
  const date = parseZonedDate(text);
  if (date === null) throw new BadRequestException(`\`${name}\` must be ${ZONED_DATE_HINT}`);
  return date;
};

export const parseDateRange = (from: string | undefined, to: string | undefined): DateRange => {
  const range = { from: parseDate(from, 'from'), to: parseDate(to, 'to') };
  if (range.from !== undefined && range.to !== undefined && range.from >= range.to) {
    throw new BadRequestException('`from` must be before `to`');
  }
  return range;
};
