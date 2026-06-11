import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DingController } from './ding.controller';

@Module({
  imports: [AuthModule],
  controllers: [DingController],
})
export class DingModule {}
