import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { IStockProxyProvider } from '../api-compatibility/providers/interfaces';
import { CACHE_TTL } from '../../common/cache/cache.module';

export const PRICING_PROVIDER = 'PRICING_PROVIDER';

@Injectable()
export class MarketPricingApiService {
  constructor(
    @Inject(PRICING_PROVIDER)
    private readonly provider: IStockProxyProvider,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  private async cachedGet<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cached = await this.cache.get<T>(key);
    if (cached != null) return cached;
    const result = await fn();
    await this.cache.set(key, result, ttlSeconds * 1000);
    return result;
  }

  async getMarket(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/market', query);
  }

  async postMarket(body: unknown): Promise<unknown> {
    return this.provider.post('/api/market', body);
  }

  async getMarketIndustries(): Promise<unknown> {
    return this.provider.get('/api/market/industries');
  }

  async getMarketProprietaryTrading(): Promise<unknown> {
    return this.provider.get('/api/market/proprietary-trading');
  }

  async postMarketboardIndexQuote(body: unknown): Promise<unknown> {
    return this.provider.post('/api/marketboard/index-quote', body);
  }

  async getMarketboardOverview(): Promise<unknown> {
    return this.provider.get('/api/marketboard/overview');
  }

  async getGoldPrices(): Promise<unknown> {
    return this.cachedGet(
      'api:gold-prices',
      CACHE_TTL.GOLD_PRICES,
      () => this.provider.get('/api/gold-prices') as Promise<unknown>,
    );
  }

  async getExchangeRates(): Promise<unknown> {
    return this.cachedGet(
      'api:exchange-rates',
      CACHE_TTL.EXCHANGE_RATES,
      () => this.provider.get('/api/exchange-rates') as Promise<unknown>,
    );
  }

  async getVietstockIndustries(): Promise<unknown> {
    return this.provider.get('/api/vietstock/industries');
  }

  async getMarketSentiment(): Promise<unknown> {
    return this.cachedGet(
      'api:market-sentiment',
      CACHE_TTL.MARKET_SENTIMENT,
      () => this.provider.get('/api/market-sentiment') as Promise<unknown>,
    );
  }

  async getMarketSentimentRecent(): Promise<unknown> {
    return this.cachedGet(
      'api:market-sentiment:recent',
      CACHE_TTL.MARKET_SENTIMENT,
      () => this.provider.get('/api/market-sentiment/recent') as Promise<unknown>,
    );
  }

  async getSuggestStockLatest(): Promise<unknown> {
    return this.provider.get('/api/suggest-stock/latest');
  }

  async getAiTopStocks(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/ai-top-stocks', query);
  }

  async getTopStocks(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/top-stocks', query);
  }
}
