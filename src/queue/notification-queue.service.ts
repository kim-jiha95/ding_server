import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PUSH_QUEUE, PUSH_SEND_JOB } from './queue.constants';

export interface PushNotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationQueueService.name);
  private readonly queue?: Queue;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return;
    this.queue = new Queue(PUSH_QUEUE, {
      connection: { url: redisUrl } as never,
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 500 },
    });
  }

  async enqueuePush(payload: PushNotificationPayload) {
    if (!this.queue) {
      this.logger.log(`push queue unavailable, inline fallback userId=${payload.userId} title=${payload.title}`);
      return { queued: false, mode: 'inline-fallback', ...payload };
    }

    const job = await this.queue.add(PUSH_SEND_JOB, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
    });
    this.logger.log(`push job queued id=${job.id} userId=${payload.userId}`);
    return { queued: true, mode: 'bullmq', jobId: job.id, ...payload };
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
