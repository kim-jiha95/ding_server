import { Global, Module } from '@nestjs/common';
import { CacheModule } from '../cache/cache.module';
import { DataService } from './data.service';
import { EncounterGenerationService } from './encounter-generation.service';

@Global()
@Module({
  imports: [CacheModule],
  providers: [DataService, EncounterGenerationService],
  exports: [DataService, EncounterGenerationService],
})
export class DataModule {}
