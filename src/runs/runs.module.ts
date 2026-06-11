import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RunsController } from './runs.controller';

@Module({
  imports: [AuthModule],
  controllers: [RunsController],
})
export class RunsModule {}
