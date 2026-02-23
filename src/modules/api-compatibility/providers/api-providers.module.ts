import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import {
  VietstockProvider,
  FireAntProvider,
  AiCrawlerProvider,
  VnStockProvider,
  SStockApiProvider,
  SimplizeApiProvider,
} from './index';

@Module({
  imports: [
    HttpModule.register({ timeout: 30000, maxRedirects: 5 }),
    ConfigModule,
  ],
  providers: [
    VietstockProvider,
    FireAntProvider,
    AiCrawlerProvider,
    VnStockProvider,
    SStockApiProvider,
    SimplizeApiProvider,
  ],
  exports: [
    VietstockProvider,
    FireAntProvider,
    AiCrawlerProvider,
    VnStockProvider,
    SStockApiProvider,
    SimplizeApiProvider,
  ],
})
export class ApiProvidersModule {}
