import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseJob } from './base.job';
import { JobRunService } from '../services/job-run.service';
import { AdvisoryLockService } from '../services/advisory-lock.service';
import { MarketHoursService } from '../services/market-hours.service';
import { UpsertService } from '../services/upsert.service';
import { DynamicProviderAdapter } from '../providers/dynamic-provider.adapter';
import { ProviderFactoryService } from '../providers/provider-factory.service';
import { Symbol, MarketIndex } from '../entities';
import { CandleInterval } from '../enums';

@Injectable()
export class EodDailyJob extends BaseJob {
  protected readonly jobName = 'EodDailyJob';
  protected readonly logger = new Logger(EodDailyJob.name);

  constructor(
    jobRunService: JobRunService,
    advisoryLockService: AdvisoryLockService,
    marketHoursService: MarketHoursService,
    private readonly upsertService: UpsertService,
    private readonly providerAdapter: DynamicProviderAdapter,
    private readonly providerFactory: ProviderFactoryService,
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    @InjectRepository(MarketIndex)
    private readonly indexRepository: Repository<MarketIndex>,
  ) {
    super(jobRunService, advisoryLockService, marketHoursService);
  }

  @Cron('35 15 * * 1-5', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleCron(): Promise<void> {
    await this.runWithLock({}, async () => {
      return this.execute();
    });
  }

  private async execute(): Promise<number> {
    const today = new Date();
    let totalItems = 0;

    const activeSymbols = await this.symbolRepository.find({
      where: { isActive: true },
    });
    const tickers = activeSymbols.map((s) => s.ticker);

    const batchSize = 50;
    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      const stockFetch = await this.providerAdapter.invokeMarket('fetchDailyCandles1d', [
        batch,
        today,
      ]);
      const candles = stockFetch.value;
      const dataSource = await this.providerFactory.getDataSourceByCode(stockFetch.providerCode);
      if (!dataSource) {
        throw new Error(`Data source ${stockFetch.providerCode} not found`);
      }
      
      if (candles.length > 0) {
        const tickerToId = new Map(activeSymbols.map((s) => [s.ticker, s.id]));
        
        const candleRecords = candles
          .filter((c) => tickerToId.has(c.ticker))
          .map((c) => ({
            symbolId: tickerToId.get(c.ticker)!,
            interval: CandleInterval.DAILY,
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

    const indices = await this.indexRepository.find();
    const indexCodes = indices.map((i) => i.code);

    if (indexCodes.length > 0) {
      const indexFetch = await this.providerAdapter.invokeMarket('fetchIndexCandles', [
        indexCodes,
        '1d',
        today,
        today,
      ]);
      const indexCandles = indexFetch.value;
      const dataSource = await this.providerFactory.getDataSourceByCode(indexFetch.providerCode);
      if (!dataSource) {
        throw new Error(`Data source ${indexFetch.providerCode} not found`);
      }
      
      if (indexCandles.length > 0) {
        const codeToId = new Map(indices.map((i) => [i.code, i.id]));
        
        const indexRecords = indexCandles
          .filter((c) => codeToId.has(c.indexCode))
          .map((c) => ({
            indexId: codeToId.get(c.indexCode)!,
            interval: CandleInterval.DAILY,
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

    this.logger.log(`EOD daily job completed: ${totalItems} items processed`);
    return totalItems;
  }
}
