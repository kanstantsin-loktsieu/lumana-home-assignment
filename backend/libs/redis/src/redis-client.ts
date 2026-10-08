import { createClient } from 'redis';

// fail fast while Redis is down instead of queueing commands without bound
export const createRedisClient = (host: string, port: number) =>
  createClient({ url: `redis://${host}:${port}`, disableOfflineQueue: true });

export type RedisClient = ReturnType<typeof createRedisClient>;

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
