/** Base 36 (digits and letters) keeps the timestamp part of the id short. */
const TIMESTAMP_RADIX = 36;

let sequence = 0;

/** Generated in the component before dispatch, so reducers stay pure. */
export const nextPolygonId = (): string =>
  `poly-${Date.now().toString(TIMESTAMP_RADIX)}-${sequence++}`;
