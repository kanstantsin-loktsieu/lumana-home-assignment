import type { Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { errorMessage } from '@app/common/error-message';
import { IMAGE_RECORD_COLUMNS } from '../../shared/constants/image-record-columns';
import type { ImageRecord } from '../../shared/models/image-record';
import { ImportFormatError } from './import-format-error';

const REQUIRED_COLUMNS: readonly (keyof ImageRecord)[] = ['nasaId', 'title', 'dateCreated'];

const plainValue = (value: ExcelJS.CellValue): unknown => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value === 'string' || typeof value === 'boolean')
    return value;
  if (typeof value === 'number') return String(value);
  if ('richText' in value) return value.richText.map((run) => run.text).join('');
  if ('hyperlink' in value) return plainValue(value.text as ExcelJS.CellValue);
  if ('result' in value) return plainValue(value.result as ExcelJS.CellValue);
  return null;
};

// matched by header text, so column order in the sheet does not matter
const columnIndexes = (header: ExcelJS.Row): Map<keyof ImageRecord, number> => {
  const indexes = new Map<keyof ImageRecord, number>();
  header.eachCell((cell, columnNumber) => {
    const column = IMAGE_RECORD_COLUMNS.find(({ key }) => key === String(cell.value).trim());
    if (column) indexes.set(column.key, columnNumber);
  });
  const missing = REQUIRED_COLUMNS.filter((key) => !indexes.has(key));
  if (missing.length > 0) {
    throw new ImportFormatError(`Missing required columns: ${missing.join(', ')}`);
  }
  return indexes;
};

export async function* xlsxImageRows(input: Readable): AsyncGenerator<unknown> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(input, {
    worksheets: 'emit',
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    styles: 'ignore',
    entries: 'emit',
  });
  let indexes: Map<keyof ImageRecord, number> | null = null;
  try {
    for await (const worksheet of workbook) {
      for await (const row of worksheet) {
        if (indexes === null) {
          indexes = columnIndexes(row);
          continue;
        }
        if (!row.hasValues) continue;
        yield Object.fromEntries(
          [...indexes].map(([key, columnNumber]) => [
            key,
            plainValue(row.getCell(columnNumber).value),
          ]),
        );
      }
      // only the first worksheet holds data
      break;
    }
  } catch (error) {
    if (error instanceof ImportFormatError) throw error;
    throw new ImportFormatError(`Invalid XLSX file: ${errorMessage(error)}`);
  }
  if (indexes === null) throw new ImportFormatError('The workbook has no header row');
}
