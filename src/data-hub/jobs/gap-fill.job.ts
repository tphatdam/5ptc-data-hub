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
import { Symbol, StockCandle } from '../entities';
import { CandleInterval } from '../enums';
import { subDays, startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class GapFillJob extends BaseJob {
  protected readonly jobName = 'GapFillJob';
  protected readonly logger = new Logger(GapFillJob.name);
  private readonly maxSymbolsPerRun = 50;
  private readonly maxRetries = 3;

  constructor(
    jobRunService: JobRunService,
    advisoryLockService: AdvisoryLockService,
    marketHoursService: MarketHoursService,
    private readonly upsertService: UpsertService,
    private readonly providerFactory: ProviderFactoryService,
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    @InjectRepository(StockCandle)
    private readonly candleRepository: Repository<StockCandle>,
  ) {
    super(jobRunService, advisoryLockService, marketHoursService);
  }

  @Cron('0 16 * * 1-5', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleCron(): Promise<void> {
    await this.runWithLock({}, async () => {
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

    const tradingDays = this.marketHoursService.getLastNTradingDays(2);
    if (tradingDays.length === 0) {
      this.logger.debug('No trading days to check');
      return 0;
    }

    const symbolsWithGaps = await this.findSymbolsWithGaps(tradingDays);
    
    if (symbolsWithGaps.length === 0) {
      this.logger.debug('No gaps found');
      return 0;
    }

    const symbolsToProcess = symbolsWithGaps.slice(0, this.maxSymbolsPerRun);
    let totalFilled = 0;
    let consecutiveFailures = 0;

    for (const symbol of symbolsToProcess) {
      if (consecutiveFailures >= this.maxRetries) {
        this.logger.warn('Too many consecutive failures, stopping gap fill');
        break;
      }

      try {
        const from = startOfDay(tradingDays[tradingDays.length - 1]);
        const to = endOfDay(tradingDays[0]);

        const candles = await provider.fetchIntradayCandles15m([symbol.ticker], from, to);
        
        if (candles.length > 0) {
          const candleRecords = candles.map((c) => ({
            symbolId: symbol.id,
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
          totalFilled += result.inserted + result.updated;
        }

        consecutiveFailures = 0;
      } catch (error) {
        consecutiveFailures++;
        this.logger.warn(`Failed to fill gaps for ${symbol.ticker}: ${error.message}`);
      }
    }

    this.logger.log(`Gap fill completed: ${totalFilled} candles filled for ${symbolsToProcess.length} symbols`);
    return totalFilled;
  }

  private async findSymbolsWithGaps(tradingDays: Date[]): Promise<Symbol[]> {
    const activeSymbols = await this.symbolRepository.find({
      where: { isActive: true },
    });

    const expectedCandlesPerDay = 16;
    const expectedTotal = tradingDays.length * expectedCandlesPerDay;

    const symbolsWithGaps: Symbol[] = [];

    for (const symbol of activeSymbols) {
      const count = await this.candleRepository.count({
        where: {
          symbolId: symbol.id,
          interval: CandleInterval.INTRADAY_15M,
        },
      });

      if (count < expectedTotal * 0.8) {
        symbolsWithGaps.push(symbol);
      }
    }

    return symbolsWithGaps;
  }
}
