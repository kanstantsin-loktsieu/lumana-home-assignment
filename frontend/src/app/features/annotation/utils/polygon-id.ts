const TIMESTAMP_RADIX = 36;

let sequence = 0;

export const nextPolygonId = (): string =>
  `poly-${Date.now().toString(TIMESTAMP_RADIX)}-${sequence++}`;
