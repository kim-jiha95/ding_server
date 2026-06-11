import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RunRecord } from '../data/types';
import { ENCOUNTER_GENERATE_JOB, ENCOUNTER_QUEUE } from './queue.constants';

@Injectable()
export class EncounterQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(EncounterQueueService.name);
  private readonly queue?: Queue;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return;
    this.queue = new Queue(ENCOUNTER_QUEUE, {
      connection: { url: redisUrl } as never,
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 500 },
    });
  }

  async enqueueGenerateEncounters(userId: string, run: RunRecord) {
    if (!this.queue) {
      this.logger.log(`queue unavailable, inline fallback userId=${userId} runId=${run.id}`);
      return { queued: false, userId, runId: run.id, mode: 'inline-fallback' };
    }

    const job = await this.queue.add(ENCOUNTER_GENERATE_JOB, { userId, run }, { attempts: 3, backoff: { type: 'exponential', delay: 3000 } });
    this.logger.log(`encounter job queued id=${job.id} userId=${userId} runId=${run.id}`);
    return { queued: true, userId, runId: run.id, jobId: job.id, mode: 'bullmq' };
  }

  async onModuleDestroy() {
    await this.queue?.close();
  }
}
