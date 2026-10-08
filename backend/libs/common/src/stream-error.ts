import type { Readable, Writable } from 'node:stream';

// the listener is removed once `work` settles, so nothing accumulates across calls
export const raceStreamError = <T>(work: Promise<T>, stream: Readable | Writable): Promise<T> => {
  if (stream.errored !== null) {
    work.catch(() => undefined);
    return Promise.reject(stream.errored);
  }
  return new Promise<T>((resolve, reject) => {
    stream.once('error', reject);
    void work.then(resolve, reject).finally(() => stream.off('error', reject));
  });
};
