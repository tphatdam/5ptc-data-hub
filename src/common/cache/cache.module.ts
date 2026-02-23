import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const CACHE_TTL = {
  GOLD_PRICES: 60,
  EXCHANGE_RATES: 900,
  STOCK_PRICE: 30,
  STOCK_PROFILE: 300,
  MARKET_SENTIMENT: 30,
} as const;

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => ({
        ttl: 60 * 1000,
      }),
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
