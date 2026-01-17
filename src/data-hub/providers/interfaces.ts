import { CandleDTO, IndexCandleDTO, SnapshotDTO, GoldPriceDTO, NewsArticleDTO } from '../dto';

export interface MarketDataProvider {
  readonly code: string;

  fetchIntradayCandles15m(
    tickers: string[],
    from: Date,
    to: Date
  ): Promise<CandleDTO[]>;

  fetchDailyCandles1d(
    tickers: string[],
    date: Date
  ): Promise<CandleDTO[]>;

  fetchIndexCandles(
    indexCodes: string[],
    interval: '1d' | '15m',
    from: Date,
    to: Date
  ): Promise<IndexCandleDTO[]>;
}

export interface FundamentalsProvider {
  readonly code: string;

  fetchSnapshots(tickers: string[]): Promise<SnapshotDTO[]>;
}

export interface GoldPriceProvider {
  readonly code: string;

  fetchGold(provider: string, date: Date): Promise<GoldPriceDTO | null>;
}

export interface NewsProvider {
  readonly code: string;

  fetchLatest(since: Date): Promise<NewsArticleDTO[]>;
}

export interface SymbolInfo {
  ticker: string;
  exchangeCode: string;
  companyName?: string;
  industry?: string;
  isin?: string;
}

export interface SymbolListProvider {
  readonly code: string;

  fetchSymbolList(): Promise<SymbolInfo[]>;
}
