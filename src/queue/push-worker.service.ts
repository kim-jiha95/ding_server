import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PushGatewayService } from './push-gateway.service';
import { PushNotificationPayload } from './notification-queue.service';
import { PUSH_QUEUE, PUSH_SEND_JOB } from './queue.constants';

@Injectable()
export class PushWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushWorkerService.name);
  private worker?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushGatewayService: PushGatewayService,
  ) {}

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.log('REDIS_URL not set, push worker disabled');
      return;
    }

    this.worker = new Worker(
      PUSH_QUEUE,
      async (job: Job<PushNotificationPayload>) => {
        if (job.name !== PUSH_SEND_JOB) return;

        const tokens = await this.prisma.deviceToken.findMany({
          where: { userId: job.data.userId, isActive: true },
          select: { token: true, platform: true },
        });

        if (!tokens.length) {
          this.logger.log(`no active device tokens userId=${job.data.userId}`);
          return;
        }

        const result = await this.pushGatewayService.sendMany(tokens, {
          title: job.data.title,
          body: job.data.body,
          data: job.data.data,
        });
        this.logger.log(`push dispatched userId=${job.data.userId} count=${tokens.length} mode=${result.mode}`);
      },
      { connection: { url: redisUrl } as never },
    );

    this.worker.on('completed', (job) => this.logger.log(`push job completed id=${job.id}`));
    this.worker.on('failed', (job, error) => this.logger.error(`push job failed id=${job?.id}`, error?.stack));
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
