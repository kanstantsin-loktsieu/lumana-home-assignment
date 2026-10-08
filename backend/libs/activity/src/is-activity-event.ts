import { isOneOf, isRecord } from '@app/common/type-guards';
import {
  ACTIVITY_SOURCES,
  API_OUTCOMES,
  DOMAIN_EVENT_NAMES,
  type ActivityEvent,
} from './activity-event';

const isAttributeValue = (value: unknown): boolean =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

export const isActivityEvent = (value: unknown): value is ActivityEvent => {
  if (!isRecord(value)) return false;
  const { kind, id, source, occurredAt } = value;
  if (typeof id !== 'string' || !isOneOf(ACTIVITY_SOURCES, source)) return false;
  if (typeof occurredAt !== 'string' || Number.isNaN(Date.parse(occurredAt))) return false;
  if (kind === 'api-request') {
    return (
      typeof value['method'] === 'string' &&
      typeof value['route'] === 'string' &&
      typeof value['statusCode'] === 'number' &&
      typeof value['durationMs'] === 'number' &&
      isOneOf(API_OUTCOMES, value['outcome'])
    );
  }
  if (kind === 'domain-event') {
    const attributes = value['attributes'];
    return (
      isOneOf(DOMAIN_EVENT_NAMES, value['name']) &&
      typeof value['value'] === 'number' &&
      isRecord(attributes) &&
      Object.values(attributes).every(isAttributeValue)
    );
  }
  return false;
};
