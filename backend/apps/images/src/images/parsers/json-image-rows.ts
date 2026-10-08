import type { Readable } from 'node:stream';
import { streamArray } from 'stream-json/streamers/stream-array.js';
import { errorMessage } from '@app/common/error-message';
import { ImportFormatError } from './import-format-error';

export async function* jsonImageRows(input: Readable): AsyncGenerator<unknown> {
  const items = input.pipe(streamArray.withParserAsStream());
  input.once('error', (error) => items.destroy(error));
  try {
    for await (const item of items) {
      yield (item as streamArray.StreamArrayItem).value;
    }
  } catch (error) {
    throw new ImportFormatError(`Invalid JSON file: ${errorMessage(error)}`);
  }
}
