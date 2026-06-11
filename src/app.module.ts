import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { RunsModule } from './runs/runs.module';
import { DingModule } from './ding/ding.module';
import { ChatModule } from './chat/chat.module';
import { DataModule } from './data/data.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { CacheModule } from './cache/cache.module';
import { AppController } from './app.controller';

@Module({
  imports: [PrismaModule, CacheModule, QueueModule, DataModule, AuthModule, ProfileModule, RunsModule, DingModule, ChatModule],
  controllers: [AppController],
})
export class AppModule {}
