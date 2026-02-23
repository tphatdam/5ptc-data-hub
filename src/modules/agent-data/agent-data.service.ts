import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { subDays, format, parseISO } from 'date-fns';
import {
  Symbol,
  StockCandle,
  StockSnapshot,
  NewsArticle,
  StockInsiderEvent,
  StockFinancialStatementFact,
  MarketIndex,
  IndexCandle,
  DataSource as DataSourceEntity,
} from '../data-hub/entities';
import { CandleInterval } from '../data-hub/enums';
import { MarketIndexCode } from '../data-hub/enums';
import { metaDb, metaLiveFallback, AgentResponseMeta } from './agent-data.types';
import { ProviderFactoryService } from '../data-hub/providers/provider-factory.service';
import { MarketDataProvider, FundamentalsProvider, CompanyIntelProvider } from '../data-hub/providers/interfaces';
import { SStockProxyService } from '../market-company/sstock-proxy.service';

export interface QuoteResult {
  data: {
    last_price?: number;
    change?: number;
    change_percent?: number;
    volume?: number;
    high?: number;
    low?: number;
    open?: number;
    as_of?: string;
    [key: string]: unknown;
  };
  meta: AgentResponseMeta;
}

export interface HistoryResult {
  data: Array<{ ts: string; open: number; high: number; low: number; close: number; volume: number }>;
  meta: AgentResponseMeta;
}

export interface FundamentalsResult {
  data: Record<string, unknown>;
  meta: AgentResponseMeta;
}

export interface StatementsResult {
  data: Array<{ period_year: number; period_quarter?: number; metric_code: string; value: string | number }>;
  meta: AgentResponseMeta;
}

export interface NewsResult {
  data: Array<{ id: number; title: string; summary?: string; published_at?: string; tickers?: string[] }>;
  meta: AgentResponseMeta;
}

export interface InsiderSentimentResult {
  data: Record<string, unknown>;
  meta: AgentResponseMeta;
}

export interface InsiderTransactionsResult {
  data: Array<Record<string, unknown>>;
  meta: AgentResponseMeta;
}

export interface IndexSummaryResult {
  data: Record<string, unknown>;
  meta: AgentResponseMeta;
}

@Injectable()
export class AgentDataService {
  private readonly logger = new Logger(AgentDataService.name);

  constructor(
    @InjectRepository(Symbol)
    private readonly symbolRepo: Repository<Symbol>,
    @InjectRepository(StockCandle)
    private readonly stockCandleRepo: Repository<StockCandle>,
    @InjectRepository(StockSnapshot)
    private readonly snapshotRepo: Repository<StockSnapshot>,
    @InjectRepository(NewsArticle)
    private readonly newsRepo: Repository<NewsArticle>,
    @InjectRepository(StockInsiderEvent)
    private readonly insiderRepo: Repository<StockInsiderEvent>,
    @InjectRepository(StockFinancialStatementFact)
    private readonly statementFactRepo: Repository<StockFinancialStatementFact>,
    @InjectRepository(MarketIndex)
    private readonly marketIndexRepo: Repository<MarketIndex>,
    @InjectRepository(IndexCandle)
    private readonly indexCandleRepo: Repository<IndexCandle>,
    @InjectRepository(DataSourceEntity)
    private readonly dataSourceRepo: Repository<DataSourceEntity>,
    private readonly configService: ConfigService,
    private readonly providerFactory: ProviderFactoryService,
    private readonly sstockProxy: SStockProxyService,
  ) {}

  /** Resolve symbol to id by ticker (case-insensitive). */
  private async resolveSymbolId(ticker: string): Promise<number | null> {
    const s = await this.symbolRepo.findOne({
      where: { ticker: ticker.toUpperCase().trim(), isActive: true },
    });
    return s?.id ?? null;
  }

  /** Normalize index symbol: UPCOM -> UPCOMINDEX for DB. */
  private normalizeIndexSymbol(symbol: string): string {
    const u = symbol.toUpperCase().trim();
    if (u === 'UPCOM') return MarketIndexCode.UPCOMINDEX;
    if (u === 'VNINDEX') return MarketIndexCode.VNINDEX;
    if (u === 'HNXINDEX') return MarketIndexCode.HNXINDEX;
    return u;
  }

  async getQuote(symbol: string): Promise<QuoteResult> {
    const symbolId = await this.resolveSymbolId(symbol);
    if (!symbolId) {
      return {
        data: {},
        meta: metaLiveFallback('none', new Date().toISOString()),
      };
    }

    const latest = await this.stockCandleRepo.findOne({
      where: { symbolId, interval: CandleInterval.DAILY },
      order: { ts: 'DESC' },
    });

    if (latest) {
      const prev = await this.stockCandleRepo
        .createQueryBuilder('c')
        .where('c.symbol_id = :symbolId', { symbolId })
        .andWhere('c.interval = :interval', { interval: CandleInterval.DAILY })
        .andWhere('c.ts < :ts', { ts: latest.ts })
        .orderBy('c.ts', 'DESC')
        .limit(1)
        .getOne();
      const close = Number(latest.close);
      const prevClose = prev ? Number(prev.close) : close;
      const change = close - prevClose;
      const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
      return {
        data: {
          last_price: close,
          open: Number(latest.open),
          high: Number(latest.high),
          low: Number(latest.low),
          volume: Number(latest.volume),
          change,
          change_percent: changePercent,
          as_of: latest.ts.toISOString(),
        },
        meta: metaDb(latest.ts.toISOString()),
      };
    }

    const marketProvider = await this.providerFactory.getMarketProviderEntries().then((e) => e[0]?.provider);
    if (marketProvider) {
      try {
        const today = new Date();
        const candles = await (marketProvider as MarketDataProvider).fetchDailyCandles1d([symbol.toUpperCase()], today);
        const c = candles?.[0];
        if (c) {
          return {
            data: {
              last_price: c.close,
              open: c.open,
              high: c.high,
              low: c.low,
              volume: c.volume,
              change: 0,
              change_percent: 0,
              as_of: c.ts,
            },
            meta: metaLiveFallback((marketProvider as any).code ?? 'live', c.ts),
          };
        }
      } catch (e) {
        this.logger.warn(`Quote live fallback failed for ${symbol}: ${e}`);
      }
    }

    return { data: {}, meta: metaLiveFallback('none', new Date().toISOString()) };
  }

  async getHistory(
    symbol: string,
    from: string,
    to: string,
    interval: string,
    limit: number,
  ): Promise<HistoryResult> {
    const symbolId = await this.resolveSymbolId(symbol);
    if (!symbolId) {
      return { data: [], meta: metaLiveFallback('none') };
    }

    const fromDate = from ? parseISO(from) : subDays(new Date(), 365);
    const toDate = to ? parseISO(to) : new Date();
    const take = Math.min(Math.max(limit || 100, 1), 2000);

    const candles = await this.stockCandleRepo.find({
      where: {
        symbolId,
        interval: (interval === '1d' ? CandleInterval.DAILY : CandleInterval.DAILY) as CandleInterval,
        ts: Between(fromDate, toDate),
      },
      order: { ts: 'ASC' },
      take,
    });

    if (candles.length > 0) {
      return {
        data: candles.map((c) => ({
          ts: new Date(c.ts).toISOString(),
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume),
        })),
        meta: metaDb(candles[candles.length - 1].ts.toISOString()),
      };
    }

    const marketProvider = await this.providerFactory.getMarketProviderEntries().then((e) => e[0]?.provider);
    if (marketProvider) {
      try {
        const candlesLive = await (marketProvider as MarketDataProvider).fetchDailyCandles1d(
          [symbol.toUpperCase()],
          toDate,
        );
        const filtered = candlesLive
          .filter((c) => {
            const t = new Date(c.ts).getTime();
            return t >= fromDate.getTime() && t <= toDate.getTime();
          })
          .slice(-take)
          .map((c) => ({
            ts: c.ts,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          }));
        return {
          data: filtered,
          meta: metaLiveFallback((marketProvider as any).code ?? 'live'),
        };
      } catch (e) {
        this.logger.warn(`History live fallback failed for ${symbol}: ${e}`);
      }
    }

    return { data: [], meta: metaLiveFallback('none') };
  }

  async getFundamentals(symbol: string, asOf?: string): Promise<FundamentalsResult> {
    const symbolId = await this.resolveSymbolId(symbol);
    if (!symbolId) {
      return { data: {}, meta: metaLiveFallback('none') };
    }

    const snapshot = await this.snapshotRepo.findOne({
      where: { symbolId },
      order: { asOf: 'DESC' },
    });

    if (snapshot) {
      const data: Record<string, unknown> = {
        pe: snapshot.pe != null ? Number(snapshot.pe) : null,
        pb: snapshot.pb != null ? Number(snapshot.pb) : null,
        ps: snapshot.ps != null ? Number(snapshot.ps) : null,
        roe: snapshot.roe != null ? Number(snapshot.roe) : null,
        roa: snapshot.roa != null ? Number(snapshot.roa) : null,
        ev: snapshot.ev != null ? Number(snapshot.ev) : null,
        eps: snapshot.eps != null ? Number(snapshot.eps) : null,
        market_cap: snapshot.marketCap != null ? Number(snapshot.marketCap) : null,
        as_of: snapshot.asOf.toISOString(),
      };
      return { data, meta: metaDb(snapshot.asOf.toISOString()) };
    }

    const fundProvider = await this.providerFactory.getFundamentalsProviderEntries().then((e) => e[0]?.provider);
    if (fundProvider) {
      try {
        const snapshots = await (fundProvider as FundamentalsProvider).fetchSnapshots([symbol.toUpperCase()]);
        const s = snapshots?.[0];
        if (s && (s as any).pe != null) {
          return {
            data: s as unknown as Record<string, unknown>,
            meta: metaLiveFallback((fundProvider as any).code ?? 'live'),
          };
        }
      } catch (e) {
        this.logger.warn(`Fundamentals live fallback failed for ${symbol}: ${e}`);
      }
    }

    return { data: {}, meta: metaLiveFallback('none') };
  }

  async getStatements(
    symbol: string,
    type: 'balance_sheet' | 'income_statement' | 'cashflow',
    frequency: string,
    limit: number,
  ): Promise<StatementsResult> {
    const symbolId = await this.resolveSymbolId(symbol);
    if (!symbolId) {
      return { data: [], meta: metaLiveFallback('none') };
    }

    const rows = await this.statementFactRepo.find({
      where: { symbolId, statementType: type, frequency: frequency || 'quarterly' },
      order: { periodYear: 'DESC', periodQuarter: 'DESC' },
      take: Math.min(limit || 100, 500),
    });

    if (rows.length > 0) {
      const byPeriod = new Map<string, Record<string, string | number>>();
      for (const r of rows) {
        const key = `${r.periodYear}-${r.periodQuarter ?? 'yearly'}`;
        if (!byPeriod.has(key)) byPeriod.set(key, { period_year: r.periodYear, period_quarter: r.periodQuarter ?? 0 });
        const row = byPeriod.get(key)!;
        row[r.metricCode] = r.value != null ? Number(r.value) : 0;
      }
      return {
        data: Array.from(byPeriod.values()) as any,
        meta: metaDb(),
      };
    }

    const liveEnabled = this.configService.get<boolean>('agentData.liveFallbackEnabled') !== false;
    if (liveEnabled) {
      try {
        const path = `/api/v1/company/financial/${symbol.toUpperCase()}/${type}`;
        const raw = await this.sstockProxy.proxyGet(path, { frequency: frequency || 'quarterly' });
        if (raw && typeof raw === 'object') {
          const data = (raw as any).data ?? raw;
          const rows = Array.isArray(data) ? data : [data];
          const source = await this.dataSourceRepo.findOne({ where: { code: 'SSTOCK_API' } });
          const sourceId = source?.id ?? 1;
          for (const item of rows.slice(0, limit || 100)) {
            const periodYear = item.periodYear ?? item.year ?? new Date().getFullYear();
            const periodQuarter = item.periodQuarter ?? item.quarter ?? null;
            for (const [metricCode, value] of Object.entries(item)) {
              if (['periodYear', 'periodQuarter', 'year', 'quarter'].includes(metricCode)) continue;
              if (typeof value !== 'number' && typeof value !== 'string') continue;
              try {
                await this.statementFactRepo.upsert(
                  {
                    symbolId,
                    statementType: type,
                    frequency: frequency || 'quarterly',
                    periodYear,
                    periodQuarter,
                    metricCode,
                    metricLabel: metricCode,
                    value: String(value),
                    currency: 'VND',
                    sourceId,
                    rawPayload: item,
                  },
                  { conflictPaths: ['symbolId', 'statementType', 'frequency', 'periodYear', 'periodQuarter', 'metricCode', 'sourceId'] },
                );
              } catch (_) {
                // ignore duplicate or constraint errors
              }
            }
          }
          const rows2 = await this.statementFactRepo.find({
            where: { symbolId, statementType: type, frequency: frequency || 'quarterly' },
            order: { periodYear: 'DESC', periodQuarter: 'DESC' },
            take: Math.min(limit || 100, 500),
          });
          const byPeriod2 = new Map<string, Record<string, string | number>>();
          for (const r of rows2) {
            const key = `${r.periodYear}-${r.periodQuarter ?? 'y'}`;
            if (!byPeriod2.has(key)) byPeriod2.set(key, { period_year: r.periodYear, period_quarter: r.periodQuarter ?? 0 });
            byPeriod2.get(key)![r.metricCode] = r.value != null ? Number(r.value) : 0;
          }
          return {
            data: Array.from(byPeriod2.values()) as any,
            meta: metaLiveFallback('SSTOCK_API'),
          };
        }
      } catch (e) {
        this.logger.warn(`Statements live fallback failed for ${symbol}: ${e}`);
      }
    }

    return { data: [], meta: metaLiveFallback('none') };
  }

  async getNews(symbol: string, startDate?: string, endDate?: string, limit?: number): Promise<NewsResult> {
    const symbolId = await this.resolveSymbolId(symbol);
    const take = Math.min(limit || 50, 200);
    if (!symbolId) {
      return { data: [], meta: metaLiveFallback('none') };
    }

    const sym = await this.symbolRepo.findOne({ where: { id: symbolId } });
    const ticker = sym?.ticker ?? symbol.toUpperCase();

    const qb = this.newsRepo
      .createQueryBuilder('n')
      .where('n.tickers @> :tickers', { tickers: [ticker] })
      .orderBy('n.published_at', 'DESC')
      .take(take);
    if (startDate) qb.andWhere('n.published_at >= :start', { start: startDate });
    if (endDate) qb.andWhere('n.published_at <= :end', { end: endDate });
    const articles = await qb.getMany();

    return {
      data: articles.map((a) => ({
        id: a.id,
        title: a.title,
        summary: a.summary ?? undefined,
        published_at: a.publishedAt?.toISOString(),
        tickers: a.tickers ?? undefined,
      })),
      meta: metaDb(articles[0]?.publishedAt?.toISOString()),
    };
  }

  async getGlobalNews(currDate?: string, lookBackDays?: number, limit?: number): Promise<NewsResult> {
    const end = currDate ? parseISO(currDate) : new Date();
    const start = subDays(end, lookBackDays ?? 7);
    const take = Math.min(limit || 50, 200);
    const articles = await this.newsRepo.find({
      where: {},
      order: { publishedAt: 'DESC' },
      take,
    });
    const filtered = articles.filter((a) => a.publishedAt && a.publishedAt >= start && a.publishedAt <= end);

    return {
      data: filtered.map((a) => ({
        id: a.id,
        title: a.title,
        summary: a.summary ?? undefined,
        published_at: a.publishedAt?.toISOString(),
        tickers: a.tickers ?? undefined,
      })),
      meta: metaDb(filtered[0]?.publishedAt?.toISOString()),
    };
  }

  async getInsiderSentiment(symbol: string, from?: string, to?: string): Promise<InsiderSentimentResult> {
    const symbolId = await this.resolveSymbolId(symbol);
    if (!symbolId) {
      return { data: {}, meta: metaLiveFallback('none') };
    }
    const fromDate = from ? parseISO(from) : subDays(new Date(), 365);
    const toDate = to ? parseISO(to) : new Date();

    const events = await this.insiderRepo.find({
      where: { symbolId },
      order: { transactionDate: 'DESC' },
      take: 500,
    });
    const filtered = events.filter(
      (e) => e.transactionDate && new Date(e.transactionDate) >= fromDate && new Date(e.transactionDate) <= toDate,
    );
    const buy = filtered.filter((e) => (e.actionType ?? '').toLowerCase().includes('buy')).length;
    const sell = filtered.filter((e) => (e.actionType ?? '').toLowerCase().includes('sell')).length;
    return {
      data: { buy, sell, total: filtered.length, from: fromDate.toISOString(), to: toDate.toISOString() },
      meta: metaDb(),
    };
  }

  async getInsiderTransactions(symbol: string, from?: string, to?: string, limit?: number): Promise<InsiderTransactionsResult> {
    const symbolId = await this.resolveSymbolId(symbol);
    if (!symbolId) {
      return { data: [], meta: metaLiveFallback('none') };
    }
    const fromDate = from ? parseISO(from) : subDays(new Date(), 365);
    const toDate = to ? parseISO(to) : new Date();
    const take = Math.min(limit || 100, 500);

    const events = await this.insiderRepo.find({
      where: { symbolId },
      order: { transactionDate: 'DESC' },
      take,
    });
    const filtered = events.filter(
      (e) => e.transactionDate && new Date(e.transactionDate) >= fromDate && new Date(e.transactionDate) <= toDate,
    );

    return {
      data: filtered.map((e) => ({
        transaction_date: e.transactionDate,
        insider_name: e.insiderName,
        action_type: e.actionType,
        quantity_executed: e.quantityExecuted != null ? Number(e.quantityExecuted) : null,
        deal_value: e.dealValue != null ? Number(e.dealValue) : null,
      })),
      meta: metaDb(),
    };
  }

  async getIndexSummary(symbol: string): Promise<IndexSummaryResult> {
    const code = this.normalizeIndexSymbol(symbol);
    const index = await this.marketIndexRepo.findOne({ where: { code } });
    if (!index) {
      return { data: {}, meta: metaLiveFallback('none') };
    }

    const latest = await this.indexCandleRepo.findOne({
      where: { indexId: index.id, interval: CandleInterval.DAILY },
      order: { ts: 'DESC' },
    });
    if (latest) {
      return {
        data: {
          priceClose: Number(latest.close),
          priceOpen: Number(latest.open),
          priceHigh: Number(latest.high),
          priceLow: Number(latest.low),
          volume: latest.volume != null ? Number(latest.volume) : null,
          ts: latest.ts.toISOString(),
        },
        meta: metaDb(latest.ts.toISOString()),
      };
    }

    return { data: {}, meta: metaLiveFallback('none') };
  }
}
