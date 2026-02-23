import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { BaseJob } from './base.job';
import { JobRunService } from '../services/job-run.service';
import { AdvisoryLockService } from '../services/advisory-lock.service';
import { MarketHoursService } from '../services/market-hours.service';
import { DynamicProviderAdapter } from '../providers/dynamic-provider.adapter';
import { ProviderFactoryService } from '../providers/provider-factory.service';
import { SymbolInfo } from '../providers/interfaces';
import { Symbol, Exchange } from '../entities';

@Injectable()
export class SymbolSyncJob extends BaseJob {
  protected readonly jobName = 'SymbolSyncJob';
  protected readonly logger = new Logger(SymbolSyncJob.name);

  constructor(
    jobRunService: JobRunService,
    advisoryLockService: AdvisoryLockService,
    marketHoursService: MarketHoursService,
    private readonly providerAdapter: DynamicProviderAdapter,
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

  async runNow(): Promise<void> {
    await this.runWithLock({ rethrowOnError: true }, async () => this.execute());
  }

  private async execute(): Promise<number> {
    const providerEntries = await this.providerFactory.getSymbolListProviderEntries();
    if (providerEntries.length === 0) {
      throw new Error('No symbol list provider available');
    }

    const providerCodes = providerEntries.map((entry) => entry.code);
    let symbolList: SymbolInfo[] = [];
    let selectedProviderCode: string | null = null;
    const failures: string[] = [];

    for (const providerCode of providerCodes) {
      try {
        const result = await this.providerAdapter.invokeSymbolList(
          'fetchSymbolList',
          [],
          [providerCode],
        );

        if (!Array.isArray(result.value) || result.value.length === 0) {
          failures.push(`${providerCode}: empty`);
          this.logger.warn(
            `Symbol list provider ${providerCode} returned empty list, trying next provider`,
          );
          continue;
        }

        symbolList = result.value;
        selectedProviderCode = result.providerCode;
        break;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${providerCode}: ${message}`);
        this.logger.warn(`Symbol list provider ${providerCode} failed, trying next provider: ${message}`);
      }
    }

    if (symbolList.length === 0) {
      throw new Error(
        `No symbols returned from providers (${providerCodes.join(', ')}). Failures: ${failures.join(' | ')}`,
      );
    }

    this.logger.log(
      `Symbol list selected provider: ${selectedProviderCode} (${symbolList.length} symbols)`,
    );

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
