import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpClientService } from '../services/http-client.service';
import { MarketDataProvider, FundamentalsProvider, SymbolListProvider, SymbolInfo } from './interfaces';
import { CandleDTO, IndexCandleDTO, SnapshotDTO } from '../dto';
import { CandleInterval } from '../enums';
import { format, subDays } from 'date-fns';
import { logPayload, toLogError } from '../../../common/logging/ingestion-log';

interface TcbsStockPrice {
  tradingDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  value?: number;
}

interface TcbsCompanyInfo {
  ticker: string;
  shortName?: string;
  companyName?: string;
  industry?: string;
  exchange?: string;
}

@Injectable()
export class TcbsProvider implements MarketDataProvider, FundamentalsProvider, SymbolListProvider {
  readonly code = 'TCBS_API';
  private readonly logger = new Logger(TcbsProvider.name);
  private readonly baseUrl = 'https://apipubaws.tcbs.com.vn';
  private readonly requestConcurrency: number;

  constructor(
    private readonly httpClient: HttpClientService,
    private readonly configService: ConfigService,
  ) {
    const configuredConcurrency = Number(
      this.configService.get<string>('dataHub.providerConcurrency') ||
        process.env.DATA_HUB_PROVIDER_CONCURRENCY ||
        '8',
    );

    const boundedConcurrency = Number.isFinite(configuredConcurrency)
      ? Math.trunc(configuredConcurrency)
      : 8;
    this.requestConcurrency = Math.min(Math.max(boundedConcurrency, 1), 20);
  }

  async fetchIntradayCandles15m(
    tickers: string[],
    from: Date,
    to: Date
  ): Promise<CandleDTO[]> {
    const perTicker = await this.mapWithConcurrency(tickers, async (ticker) => {
      const startedAt = Date.now();
      this.logFetchStarted('intraday', {
        ticker,
        from: from.toISOString(),
        to: to.toISOString(),
      });

      try {
        const url = `${this.baseUrl}/stock-insight/v1/intraday/${ticker}/investor/his/paging`;
        const response = await this.httpClient.get<{ data?: any[] }>(url, {
          params: {
            page: 0,
            size: 100,
            headIndex: -1,
          },
        });

        const trades = response.data?.data;
        if (!trades || trades.length === 0) {
          this.logFetchCompleted('intraday', {
            ticker,
            durationMs: Date.now() - startedAt,
            processed: 0,
            status: 'succeeded',
          });
          return [] as CandleDTO[];
        }

        const candles = this.aggregateToCandles(ticker, trades, '15m');
        this.logFetchCompleted('intraday', {
          ticker,
          durationMs: Date.now() - startedAt,
          processed: candles.length,
          status: 'succeeded',
        });
        return candles;
      } catch (error: unknown) {
        this.logFetchCompleted('intraday', {
          ticker,
          durationMs: Date.now() - startedAt,
          status: 'failed',
          error: toLogError(error),
        });
        return [] as CandleDTO[];
      }
    });

    return perTicker.flat();
  }

  async fetchDailyCandles1d(tickers: string[], date: Date): Promise<CandleDTO[]> {
    const fromDate = format(subDays(date, 5), 'yyyy-MM-dd');
    const toDate = format(date, 'yyyy-MM-dd');

    const perTicker = await this.mapWithConcurrency(tickers, async (ticker) => {
      const startedAt = Date.now();
      this.logFetchStarted('daily', {
        ticker,
        from: fromDate,
        to: toDate,
      });

      try {
        const url = `${this.baseUrl}/stock-insight/v1/stock/bars-long-term`;
        const response = await this.httpClient.get<{ data?: TcbsStockPrice[] }>(url, {
          params: {
            ticker,
            type: 'stock',
            resolution: 'D',
            from: fromDate,
            to: toDate,
          },
        });

        const bars = response.data?.data || [];
        const candles = bars.map((bar) => ({
          ticker,
          interval: CandleInterval.DAILY,
          ts: bar.tradingDate,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
          value: bar.value,
          foreignBuyVolume: this.toNumber((bar as any).foreignBuyVolume, (bar as any).fb),
          foreignSellVolume: this.toNumber((bar as any).foreignSellVolume, (bar as any).fs),
          foreignNetVolume: this.toNumber((bar as any).foreignNetVolume, (bar as any).fnet),
          putThroughVolume: this.toNumber((bar as any).putThroughVolume, (bar as any).ptq),
          putThroughValue: this.toNumber((bar as any).putThroughValue, (bar as any).ptv),
          totalTrades: this.toNumber((bar as any).totalTrades, (bar as any).tt),
        }));
        this.logFetchCompleted('daily', {
          ticker,
          durationMs: Date.now() - startedAt,
          processed: candles.length,
          status: 'succeeded',
        });
        return candles;
      } catch (error: unknown) {
        this.logFetchCompleted('daily', {
          ticker,
          durationMs: Date.now() - startedAt,
          status: 'failed',
          error: toLogError(error),
        });
        return [] as CandleDTO[];
      }
    });

    return perTicker.flat();
  }

  async fetchIndexCandles(
    indexCodes: string[],
    interval: '1d' | '15m',
    from: Date,
    to: Date
  ): Promise<IndexCandleDTO[]> {
    const fromDate = format(from, 'yyyy-MM-dd');
    const toDate = format(to, 'yyyy-MM-dd');

    const perIndex = await this.mapWithConcurrency(indexCodes, async (indexCode) => {
      const startedAt = Date.now();
      this.logFetchStarted('index', {
        indexCode,
        interval,
        from: fromDate,
        to: toDate,
      });

      try {
        const url = `${this.baseUrl}/stock-insight/v1/stock/bars-long-term`;
        const response = await this.httpClient.get<{ data?: TcbsStockPrice[] }>(url, {
          params: {
            ticker: indexCode,
            type: 'index',
            resolution: interval === '1d' ? 'D' : '15',
            from: fromDate,
            to: toDate,
          },
        });

        const bars = response.data?.data || [];
        const candles = bars.map((bar) => ({
          indexCode,
          interval:
            interval === '1d' ? CandleInterval.DAILY : CandleInterval.INTRADAY_15M,
          ts: bar.tradingDate,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
        }));
        this.logFetchCompleted('index', {
          indexCode,
          durationMs: Date.now() - startedAt,
          processed: candles.length,
          status: 'succeeded',
        });
        return candles;
      } catch (error: unknown) {
        this.logFetchCompleted('index', {
          indexCode,
          durationMs: Date.now() - startedAt,
          status: 'failed',
          error: toLogError(error),
        });
        return [] as IndexCandleDTO[];
      }
    });

    return perIndex.flat();
  }

  async fetchSnapshots(tickers: string[]): Promise<SnapshotDTO[]> {
    const now = new Date().toISOString();

    const snapshots = await this.mapWithConcurrency(tickers, async (ticker) => {
      const startedAt = Date.now();
      this.logFetchStarted('snapshot', { ticker });

      try {
        const url = `${this.baseUrl}/tcanalysis/v1/ticker/${ticker}/overview`;
        const response = await this.httpClient.get<any>(url);

        if (!response.data) {
          this.logFetchCompleted('snapshot', {
            ticker,
            durationMs: Date.now() - startedAt,
            processed: 0,
            status: 'succeeded',
          });
          return null;
        }

        const data = response.data;
        const snapshot = {
          ticker,
          asOf: now,
          pe: data.pe ?? undefined,
          pb: data.pb ?? undefined,
          ps: data.ps ?? undefined,
          roe: data.roe ?? undefined,
          roa: data.roa ?? undefined,
          ev: data.ev ?? undefined,
          eps: data.eps ?? undefined,
          marketCap: data.marketCap ?? undefined,
          freeFloat: data.freeFloat ?? undefined,
          sharesOut: data.sharesOutstanding ?? undefined,
          foreignRoom: data.foreignTotalRoom ?? undefined,
          foreignHoldingRoom: data.foreignHoldingRoom ?? undefined,
          currentHoldingRatio: data.currentHoldingRatio ?? undefined,
          maxHoldingRatio: data.maxHoldingRatio ?? undefined,
          avgMatchVolume2w: data.averageMatchVolume2Week ?? undefined,
        } as SnapshotDTO;
        this.logFetchCompleted('snapshot', {
          ticker,
          durationMs: Date.now() - startedAt,
          processed: 1,
          status: 'succeeded',
        });
        return snapshot;
      } catch (error: unknown) {
        this.logFetchCompleted('snapshot', {
          ticker,
          durationMs: Date.now() - startedAt,
          status: 'failed',
          error: toLogError(error),
        });
        return null;
      }
    });

    return snapshots.filter((item): item is SnapshotDTO => item !== null);
  }

  async fetchSymbolList(): Promise<SymbolInfo[]> {
    const results: SymbolInfo[] = [];
    const startedAt = Date.now();
    this.logFetchStarted('symbol-list', {});

    try {
      const url = `${this.baseUrl}/stock-insight/v1/stock/all`;
      const response = await this.httpClient.get<TcbsCompanyInfo[]>(url);

      if (Array.isArray(response.data)) {
        for (const company of response.data) {
          if (company.ticker && company.exchange) {
            results.push({
              ticker: company.ticker,
              exchangeCode: this.mapExchange(company.exchange),
              companyName: company.companyName || company.shortName,
              industry: company.industry,
            });
          }
        }
      }
    } catch (error: any) {
      this.logFetchCompleted('symbol-list', {
        durationMs: Date.now() - startedAt,
        status: 'failed',
        error: toLogError(error),
      });
      throw error;
    }

    this.logFetchCompleted('symbol-list', {
      durationMs: Date.now() - startedAt,
      processed: results.length,
      status: 'succeeded',
    });

    return results;
  }

  private mapExchange(exchange: string): string {
    const upper = exchange.toUpperCase();
    if (upper.includes('HOSE') || upper === 'HSX') return 'HOSE';
    if (upper.includes('HNX')) return 'HNX';
    if (upper.includes('UPCOM')) return 'UPCOM';
    return upper;
  }

  private aggregateToCandles(
    ticker: string,
    trades: any[],
    interval: string
  ): CandleDTO[] {
    const buckets = new Map<string, { open: number; high: number; low: number; close: number; volume: number; value: number }>();

    for (const trade of trades) {
      const tradeTime = new Date(trade.t || trade.time);
      const bucketTime = this.getBucketTime(tradeTime, 15);
      const key = bucketTime.toISOString();
      const price = trade.p || trade.price || 0;
      const vol = trade.v || trade.volume || 0;

      if (!buckets.has(key)) {
        buckets.set(key, {
          open: price,
          high: price,
          low: price,
          close: price,
          volume: vol,
          value: price * vol,
        });
      } else {
        const bucket = buckets.get(key)!;
        bucket.high = Math.max(bucket.high, price);
        bucket.low = Math.min(bucket.low, price);
        bucket.close = price;
        bucket.volume += vol;
        bucket.value += price * vol;
      }
    }

    return Array.from(buckets.entries()).map(([ts, data]) => ({
      ticker,
      interval: CandleInterval.INTRADAY_15M,
      ts,
      open: data.open,
      high: data.high,
      low: data.low,
      close: data.close,
      volume: data.volume,
      value: data.value,
    }));
  }

  private getBucketTime(date: Date, intervalMinutes: number): Date {
    const minutes = date.getMinutes();
    const bucketMinutes = Math.floor(minutes / intervalMinutes) * intervalMinutes;
    const result = new Date(date);
    result.setMinutes(bucketMinutes);
    result.setSeconds(0);
    result.setMilliseconds(0);
    return result;
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    worker: (item: T) => Promise<R>,
  ): Promise<R[]> {
    if (items.length === 0) {
      return [];
    }

    const results = new Array<R>(items.length);
    const concurrency = Math.min(this.requestConcurrency, items.length);
    let cursor = 0;

    const runners = Array.from({ length: concurrency }, async () => {
      while (true) {
        const currentIndex = cursor;
        cursor += 1;

        if (currentIndex >= items.length) {
          return;
        }

        results[currentIndex] = await worker(items[currentIndex]);
      }
    });

    await Promise.all(runners);
    return results;
  }

  private toNumber(...values: unknown[]): number | undefined {
    for (const value of values) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      const parsed = typeof value === 'number' ? value : Number(String(value));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  }

  private logFetchStarted(
    endpoint: 'intraday' | 'daily' | 'index' | 'snapshot' | 'symbol-list',
    metadata: Record<string, unknown>,
  ): void {
    this.logger.log(
      logPayload({
        event: 'tcbs_fetch_started',
        module: 'data-hub.tcbs-provider',
        providerCode: this.code,
        status: 'started',
        endpoint,
        ...metadata,
      }),
    );
  }

  private logFetchCompleted(
    endpoint: 'intraday' | 'daily' | 'index' | 'snapshot' | 'symbol-list',
    metadata: Record<string, unknown>,
  ): void {
    const payload = logPayload({
      event: 'tcbs_fetch_completed',
      module: 'data-hub.tcbs-provider',
      providerCode: this.code,
      endpoint,
      ...metadata,
    });

    if (metadata.status === 'failed') {
      this.logger.warn(payload);
      return;
    }
    this.logger.log(payload);
  }
}
