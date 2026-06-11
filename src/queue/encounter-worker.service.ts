import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { CacheService } from '../cache/cache.service';
import { EncounterGenerationService } from '../data/encounter-generation.service';
import { RunRecord } from '../data/types';
import { ENCOUNTER_GENERATE_JOB, ENCOUNTER_QUEUE } from './queue.constants';

@Injectable()
export class EncounterWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EncounterWorkerService.name);
  private worker?: Worker;

  constructor(
    private readonly encounterGenerationService: EncounterGenerationService,
    private readonly cacheService: CacheService,
  ) {}

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.log('REDIS_URL not set, encounter worker disabled');
      return;
    }

    this.worker = new Worker(
      ENCOUNTER_QUEUE,
      async (job: Job<{ userId: string; run: RunRecord }>) => {
        if (job.name !== ENCOUNTER_GENERATE_JOB) return;
        await this.encounterGenerationService.generateForRun(job.data.userId, job.data.run);
        await this.cacheService.del(this.dingSummaryKey(job.data.userId));
      },
      { connection: { url: redisUrl } as never },
    );

    this.worker.on('completed', (job) => this.logger.log(`encounter job completed id=${job.id}`));
    this.worker.on('failed', (job, error) => this.logger.error(`encounter job failed id=${job?.id}`, error?.stack));
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private dingSummaryKey(userId: string) {
    return `ding-summary:${userId}`;
  }
}
