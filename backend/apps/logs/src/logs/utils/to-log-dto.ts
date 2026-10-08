import type { LogDto } from '../dto/log-page';
import type { LogDocument } from '../models/log-document';

export const toLogDto = ({ _id, occurredAt, receivedAt, ...rest }: LogDocument): LogDto => ({
  id: _id,
  ...rest,
  occurredAt: occurredAt.toISOString(),
  receivedAt: receivedAt.toISOString(),
});
