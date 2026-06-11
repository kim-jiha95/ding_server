import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis?: Redis;
  private readonly memory = new Map<string, { value: string; expiresAt: number }>();

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return;
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: true });
    this.redis.on('error', (error) => this.logger.warn(`redis error: ${error.message}`));
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const value = await this.redis.get(key);
        return value ? (JSON.parse(value) as T) : null;
      } catch {
        return null;
      }
    }

    const item = this.memory.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.memory.delete(key);
      return null;
    }
    return JSON.parse(item.value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = 60) {
    const serialized = JSON.stringify(value);
    if (this.redis) {
      try {
        await this.redis.set(key, serialized, 'EX', ttlSeconds);
        return;
      } catch {
        return;
      }
    }

    this.memory.set(key, { value: serialized, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string) {
    if (this.redis) {
      try {
        await this.redis.del(key);
        return;
      } catch {
        return;
      }
    }
    this.memory.delete(key);
  }

  async invalidatePrefix(prefix: string) {
    if (this.redis) {
      try {
        const keys = await this.redis.keys(`${prefix}*`);
        if (keys.length) await this.redis.del(keys);
        return;
      } catch {
        return;
      }
    }

    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) this.memory.delete(key);
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }
}
