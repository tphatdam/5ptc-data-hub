import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseJob } from './base.job';
import { JobRunService } from '../services/job-run.service';
import { AdvisoryLockService } from '../services/advisory-lock.service';
import { MarketHoursService } from '../services/market-hours.service';
import { UpsertService } from '../services/upsert.service';
import { ProviderFactoryService } from '../providers/provider-factory.service';
import { Symbol, MarketIndex, DataSource } from '../entities';
import { CandleInterval } from '../enums';
import { subMinutes } from 'date-fns';

@Injectable()
export class IntradayMarketJob extends BaseJob {
  protected readonly jobName = 'IntradayMarketJob';
  protected readonly logger = new Logger(IntradayMarketJob.name);

  constructor(
    jobRunService: JobRunService,
    advisoryLockService: AdvisoryLockService,
    marketHoursService: MarketHoursService,
    private readonly upsertService: UpsertService,
    private readonly providerFactory: ProviderFactoryService,
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    @InjectRepository(MarketIndex)
    private readonly indexRepository: Repository<MarketIndex>,
  ) {
    super(jobRunService, advisoryLockService, marketHoursService);
  }

  @Cron('*/15 * * * *')
  async handleCron(): Promise<void> {
    await this.runWithLock({ requireTradingHours: true }, async () => {
      return this.execute();
    });
  }

  private async execute(): Promise<number> {
    const provider = await this.providerFactory.getMarketProvider('TCBS_API');
    if (!provider) {
      throw new Error('No market data provider available');
    }

    const dataSource = await this.providerFactory.getDataSourceByCode(provider.code);
    if (!dataSource) {
      throw new Error(`Data source ${provider.code} not found`);
    }

    const now = new Date();
    const from = subMinutes(now, 30);

    const activeSymbols = await this.symbolRepository.find({
      where: { isActive: true },
      take: 100,
    });
    const tickers = activeSymbols.map((s) => s.ticker);

    const indices = await this.indexRepository.find();
    const indexCodes = indices.map((i) => i.code);

    let totalItems = 0;

    if (tickers.length > 0) {
      const candles = await provider.fetchIntradayCandles15m(tickers, from, now);
      
      if (candles.length > 0) {
        const tickerToId = new Map(activeSymbols.map((s) => [s.ticker, s.id]));
        
        const candleRecords = candles
          .filter((c) => tickerToId.has(c.ticker))
          .map((c) => ({
            symbolId: tickerToId.get(c.ticker)!,
            interval: CandleInterval.INTRADAY_15M,
            ts: new Date(c.ts),
            open: String(c.open),
            high: String(c.high),
            low: String(c.low),
            close: String(c.close),
            volume: String(c.volume),
            value: c.value ? String(c.value) : undefined,
            sourceId: dataSource.id,
          }));

        const result = await this.upsertService.upsertStockCandles(candleRecords);
        totalItems += result.inserted + result.updated;
      }
    }

    if (indexCodes.length > 0) {
      const indexCandles = await provider.fetchIndexCandles(indexCodes, '15m', from, now);
      
      if (indexCandles.length > 0) {
        const codeToId = new Map(indices.map((i) => [i.code, i.id]));
        
        const indexRecords = indexCandles
          .filter((c) => codeToId.has(c.indexCode))
          .map((c) => ({
            indexId: codeToId.get(c.indexCode)!,
            interval: CandleInterval.INTRADAY_15M,
            ts: new Date(c.ts),
            open: String(c.open),
            high: String(c.high),
            low: String(c.low),
            close: String(c.close),
            volume: c.volume ? String(c.volume) : undefined,
            sourceId: dataSource.id,
          }));

        const result = await this.upsertService.upsertIndexCandles(indexRecords);
        totalItems += result.inserted + result.updated;
      }
    }

    this.logger.log(`Intraday job completed: ${totalItems} items processed`);
    return totalItems;
  }
}
