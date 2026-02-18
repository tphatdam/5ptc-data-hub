import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Symbol } from '../../db/entities/symbol.entity';
import { QueueModule } from '../queue/queue.module';
import { SeedHttpClient } from './http/seed-http.client';
import { SeedBootstrapService } from './seed.bootstrap';
import { SeedProcessor } from './seed.processor';
import { SeedService } from './seed.service';
import { SStockSeedSource } from './sources/sstock.source';
import { StaticSeedSource } from './sources/static.source';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Symbol]), QueueModule],
  providers: [
    SeedHttpClient,
    SStockSeedSource,
    StaticSeedSource,
    SeedService,
    SeedBootstrapService,
    SeedProcessor,
  ],
})
export class SeedModule {}
