import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProvidersModule } from '../providers.module';
import { SimplizeService } from './simplize.service';

@Module({
  imports: [ConfigModule, ProvidersModule],
  providers: [SimplizeService],
  exports: [SimplizeService],
})
export class SimplizeModule {}

