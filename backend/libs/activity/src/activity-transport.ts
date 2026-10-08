import { Transport, type RedisOptions } from '@nestjs/microservices';

export const ACTIVITY_EVENT_PATTERN = 'activity.event';

export const ACTIVITY_CLIENT = Symbol('ACTIVITY_CLIENT');

const RECONNECT_DELAY_MS = 1_000;

// shared by A's client and B's server so both sides stay in step. without `retryAttempts`, the
// server side of the Nest transporter gives up after the first disconnect and B stops receiving.
export const activityTransportOptions = (host: string, port: number): RedisOptions => ({
  transport: Transport.REDIS,
  options: {
    host,
    port,
    retryAttempts: Number.POSITIVE_INFINITY,
    retryDelay: RECONNECT_DELAY_MS,
  },
});
