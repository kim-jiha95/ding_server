import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PUSH_QUEUE, PUSH_SEND_JOB } from './queue.constants';
import { PushGatewayService } from './push-gateway.service';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushGatewayService: PushGatewayService,
  ) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return;
    this.queue = new Queue(PUSH_QUEUE, {
      connection: { url: redisUrl } as never,
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 500 },
    });
  }

  async enqueuePush(payload: PushNotificationPayload) {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: payload.userId, isActive: true },
      select: { token: true, platform: true, environment: true },
    });

    if (!tokens.length) {
      this.logger.log(`no active device tokens userId=${payload.userId}`);
      return { queued: false, mode: 'no-device-tokens', ...payload };
    }

    const result = await this.pushGatewayService.sendMany(tokens, {
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });
    this.logger.log(`push dispatched inline userId=${payload.userId} count=${tokens.length} mode=${result.mode}`);
    return { queued: false, mode: `inline-${result.mode}`, ...payload };
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
