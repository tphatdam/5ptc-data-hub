import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { BaseJob } from './base.job';
import { JobRunService } from '../services/job-run.service';
import { AdvisoryLockService } from '../services/advisory-lock.service';
import { MarketHoursService } from '../services/market-hours.service';
import { ProviderFactoryService } from '../providers/provider-factory.service';
import { Symbol, Exchange } from '../entities';

@Injectable()
export class SymbolSyncJob extends BaseJob {
  protected readonly jobName = 'SymbolSyncJob';
  protected readonly logger = new Logger(SymbolSyncJob.name);

  constructor(
    jobRunService: JobRunService,
    advisoryLockService: AdvisoryLockService,
    marketHoursService: MarketHoursService,
    private readonly providerFactory: ProviderFactoryService,
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    @InjectRepository(Exchange)
    private readonly exchangeRepository: Repository<Exchange>,
  ) {
    super(jobRunService, advisoryLockService, marketHoursService);
  }

  @Cron('0 3 * * 0', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleCron(): Promise<void> {
    await this.runWithLock({}, async () => {
      return this.execute();
    });
  }

  private async execute(): Promise<number> {
    const provider = await this.providerFactory.getSymbolListProvider('TCBS_API');
    if (!provider) {
      throw new Error('No symbol list provider available');
    }

    const symbolList = await provider.fetchSymbolList();
    if (symbolList.length === 0) {
      this.logger.warn('No symbols returned from provider');
      return 0;
    }

    const exchanges = await this.exchangeRepository.find();
    const exchangeCodeToId = new Map(exchanges.map((e) => [e.code, e.id]));

    const existingSymbols = await this.symbolRepository.find();
    const existingTickerMap = new Map(existingSymbols.map((s) => [s.ticker, s]));

    const incomingTickers = new Set(symbolList.map((s) => s.ticker));
    let upsertedCount = 0;
    let deactivatedCount = 0;

    for (const item of symbolList) {
      const exchangeId = exchangeCodeToId.get(item.exchangeCode);
      if (!exchangeId) {
        this.logger.warn(`Unknown exchange ${item.exchangeCode} for ticker ${item.ticker}`);
        continue;
      }

      const existing = existingTickerMap.get(item.ticker);
      if (existing) {
        await this.symbolRepository.update(existing.id, {
          companyName: item.companyName || existing.companyName,
          industry: item.industry || existing.industry,
          isin: item.isin || existing.isin,
          isActive: true,
        });
      } else {
        await this.symbolRepository.insert({
          ticker: item.ticker,
          exchangeId,
          companyName: item.companyName,
          industry: item.industry,
          isin: item.isin,
          isActive: true,
        });
      }
      upsertedCount++;
    }

    const tickersToDeactivate = existingSymbols
      .filter((s) => s.isActive && !incomingTickers.has(s.ticker))
      .map((s) => s.id);

    if (tickersToDeactivate.length > 0) {
      await this.symbolRepository.update(
        { id: In(tickersToDeactivate) },
        { isActive: false }
      );
      deactivatedCount = tickersToDeactivate.length;
    }

    this.logger.log(
      `Symbol sync completed: ${upsertedCount} upserted, ${deactivatedCount} deactivated`
    );
    return upsertedCount + deactivatedCount;
  }
}
