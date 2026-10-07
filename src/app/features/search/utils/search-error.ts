import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { NETWORK_ERROR_STATUS } from '../../../shared/constants/error-status';
import { NasaErrorBodyDto } from '../models/nasa-images-dto';
import { SearchError } from '../models/search-result';

const RESULT_CAP_REASON = 'Maximum number of search results';

/** `SearchError.status` for a failure that is not an HTTP response at all. */
const NON_HTTP_ERROR_STATUS = -1;

const isErrorBody = (body: unknown): body is NasaErrorBodyDto =>
  typeof body === 'object' &&
  body !== null &&
  typeof (body as { reason?: unknown }).reason === 'string';

/** Maps an HTTP failure of the NASA search to a `SearchError`; the 10 000-result cap gets its own kind. */
export const toSearchError = (error: unknown): SearchError => {
  if (!(error instanceof HttpErrorResponse)) {
    return {
      kind: 'http',
      status: NON_HTTP_ERROR_STATUS,
      message: 'Unexpected error while searching.',
    };
  }
  const reason = isErrorBody(error.error) ? error.error.reason : null;
  if (error.status === HttpStatusCode.BadRequest && reason?.includes(RESULT_CAP_REASON)) {
    return { kind: 'result-cap', status: HttpStatusCode.BadRequest, message: reason };
  }
  if (error.status === NETWORK_ERROR_STATUS) {
    return {
      kind: 'network',
      status: NETWORK_ERROR_STATUS,
      message: 'Could not reach the NASA Image Library. Check your connection.',
    };
  }
  return {
    kind: 'http',
    status: error.status,
    message: reason ?? `The NASA Image Library responded with an error (${error.status}).`,
  };
};
