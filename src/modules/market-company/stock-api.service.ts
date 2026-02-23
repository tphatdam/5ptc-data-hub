import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { IStockProxyProvider } from '../api-compatibility/providers/interfaces';
import { CACHE_TTL } from '../../common/cache/cache.module';

export const STOCK_PROVIDER = 'STOCK_PROVIDER';

@Injectable()
export class StockApiService {
  constructor(
    @Inject(STOCK_PROVIDER)
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

  async getStocks(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/stocks', query);
  }

  async getStockAiSignal(symbol: string): Promise<unknown> {
    return this.provider.get(`/api/stocks/${encodeURIComponent(symbol)}/ai-signal`);
  }

  async getStocksAiSignalsBatch(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/stocks/ai-signals/batch', query);
  }

  async getStockProfile(symbol: string): Promise<unknown> {
    return this.cachedGet(
      `api:stock:profile:${symbol.toUpperCase()}`,
      CACHE_TTL.STOCK_PROFILE,
      () =>
        this.provider.get(`/api/stock/profile/${encodeURIComponent(symbol)}`) as Promise<unknown>,
    );
  }

  async getStockInfo(symbol: string): Promise<unknown> {
    return this.cachedGet(
      `api:stock:info:${symbol.toUpperCase()}`,
      CACHE_TTL.STOCK_PROFILE,
      () =>
        this.provider.get(`/api/stock/info/${encodeURIComponent(symbol)}`) as Promise<unknown>,
    );
  }

  async getStockPrice(symbol: string): Promise<unknown> {
    return this.cachedGet(
      `api:stock:price:${symbol.toUpperCase()}`,
      CACHE_TTL.STOCK_PRICE,
      () =>
        this.provider.get(`/api/stock/price/${encodeURIComponent(symbol)}`) as Promise<unknown>,
    );
  }

  async validateRelatedStocks(query?: Record<string, string>): Promise<unknown> {
    return this.provider.get('/api/validate-related-stocks', query);
  }
}
