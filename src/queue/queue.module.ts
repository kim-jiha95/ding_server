import { Global, Module, forwardRef } from '@nestjs/common';
import { DataModule } from '../data/data.module';
import { EncounterQueueService } from './encounter-queue.service';
import { EncounterWorkerService } from './encounter-worker.service';
import { NotificationQueueService } from './notification-queue.service';
import { PushGatewayService } from './push-gateway.service';
import { PushWorkerService } from './push-worker.service';

@Global()
@Module({
  imports: [forwardRef(() => DataModule)],
  providers: [EncounterQueueService, EncounterWorkerService, NotificationQueueService, PushGatewayService, PushWorkerService],
  exports: [EncounterQueueService, NotificationQueueService, PushGatewayService],
})
export class QueueModule {}
