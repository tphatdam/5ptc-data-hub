import { Injectable, Logger } from '@nestjs/common';
import { HttpClientService } from '../services/http-client.service';
import { MarketDataProvider, FundamentalsProvider, SymbolListProvider, SymbolInfo } from './interfaces';
import { CandleDTO, IndexCandleDTO, SnapshotDTO } from '../dto';
import { CandleInterval } from '../enums';
import { format, subDays } from 'date-fns';

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

  constructor(private readonly httpClient: HttpClientService) {}

  async fetchIntradayCandles15m(
    tickers: string[],
    from: Date,
    to: Date
  ): Promise<CandleDTO[]> {
    const results: CandleDTO[] = [];

    for (const ticker of tickers) {
      try {
        const url = `${this.baseUrl}/stock-insight/v1/intraday/${ticker}/investor/his/paging`;
        const response = await this.httpClient.get(url, {
          params: {
            page: 0,
            size: 100,
            headIndex: -1,
          },
        });

        if (response.data?.data) {
          const candles = this.aggregateToCandles(ticker, response.data.data, '15m');
          results.push(...candles);
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch intraday data for ${ticker}: ${error.message}`);
      }
    }

    return results;
  }

  async fetchDailyCandles1d(tickers: string[], date: Date): Promise<CandleDTO[]> {
    const results: CandleDTO[] = [];
    const fromDate = format(subDays(date, 5), 'yyyy-MM-dd');
    const toDate = format(date, 'yyyy-MM-dd');

    for (const ticker of tickers) {
      try {
        const url = `${this.baseUrl}/stock-insight/v1/stock/bars-long-term`;
        const response = await this.httpClient.get<{ data: TcbsStockPrice[] }>(url, {
          params: {
            ticker,
            type: 'stock',
            resolution: 'D',
            from: fromDate,
            to: toDate,
          },
        });

        if (response.data?.data) {
          for (const bar of response.data.data) {
            results.push({
              ticker,
              interval: CandleInterval.DAILY,
              ts: bar.tradingDate,
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: bar.volume,
              value: bar.value,
            });
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch daily data for ${ticker}: ${error.message}`);
      }
    }

    return results;
  }

  async fetchIndexCandles(
    indexCodes: string[],
    interval: '1d' | '15m',
    from: Date,
    to: Date
  ): Promise<IndexCandleDTO[]> {
    const results: IndexCandleDTO[] = [];
    const fromDate = format(from, 'yyyy-MM-dd');
    const toDate = format(to, 'yyyy-MM-dd');

    for (const indexCode of indexCodes) {
      try {
        const url = `${this.baseUrl}/stock-insight/v1/stock/bars-long-term`;
        const response = await this.httpClient.get<{ data: TcbsStockPrice[] }>(url, {
          params: {
            ticker: indexCode,
            type: 'index',
            resolution: interval === '1d' ? 'D' : '15',
            from: fromDate,
            to: toDate,
          },
        });

        if (response.data?.data) {
          for (const bar of response.data.data) {
            results.push({
              indexCode,
              interval: interval === '1d' ? CandleInterval.DAILY : CandleInterval.INTRADAY_15M,
              ts: bar.tradingDate,
              open: bar.open,
              high: bar.high,
              low: bar.low,
              close: bar.close,
              volume: bar.volume,
            });
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch index data for ${indexCode}: ${error.message}`);
      }
    }

    return results;
  }

  async fetchSnapshots(tickers: string[]): Promise<SnapshotDTO[]> {
    const results: SnapshotDTO[] = [];
    const now = new Date().toISOString();

    for (const ticker of tickers) {
      try {
        const url = `${this.baseUrl}/tcanalysis/v1/ticker/${ticker}/overview`;
        const response = await this.httpClient.get(url);

        if (response.data) {
          const data = response.data;
          results.push({
            ticker,
            asOf: now,
            pe: data.pe ?? undefined,
            eps: data.eps ?? undefined,
            marketCap: data.marketCap ?? undefined,
            freeFloat: data.freeFloat ?? undefined,
            sharesOut: data.sharesOutstanding ?? undefined,
          });
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch snapshot for ${ticker}: ${error.message}`);
      }
    }

    return results;
  }

  async fetchSymbolList(): Promise<SymbolInfo[]> {
    const results: SymbolInfo[] = [];

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
    } catch (error) {
      this.logger.error(`Failed to fetch symbol list: ${error.message}`);
      throw error;
    }

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
}
