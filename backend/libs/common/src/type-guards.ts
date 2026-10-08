export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isOneOf = <T>(values: readonly T[], value: unknown): value is T =>
  (values as readonly unknown[]).includes(value);
