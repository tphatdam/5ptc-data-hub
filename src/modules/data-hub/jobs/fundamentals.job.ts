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
import { Symbol } from '../entities';

@Injectable()
export class FundamentalsJob extends BaseJob {
  protected readonly jobName = 'FundamentalsJob';
  protected readonly logger = new Logger(FundamentalsJob.name);

  constructor(
    jobRunService: JobRunService,
    advisoryLockService: AdvisoryLockService,
    marketHoursService: MarketHoursService,
    private readonly upsertService: UpsertService,
    private readonly providerAdapter: DynamicProviderAdapter,
    private readonly providerFactory: ProviderFactoryService,
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
  ) {
    super(jobRunService, advisoryLockService, marketHoursService);
  }

  @Cron('0 2 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleCron(): Promise<void> {
    await this.runWithLock({}, async () => {
      return this.execute();
    });
  }

  async runNow(): Promise<void> {
    await this.runWithLock({}, async () => this.execute());
  }

  private async execute(): Promise<number> {
    const activeSymbols = await this.symbolRepository.find({
      where: { isActive: true },
    });
    const tickers = activeSymbols.map((s) => s.ticker);
    const tickerToId = new Map(activeSymbols.map((s) => [s.ticker, s.id]));

    let totalItems = 0;
    const batchSize = 20;

    for (let i = 0; i < tickers.length; i += batchSize) {
      const batch = tickers.slice(i, i + batchSize);
      const snapshotFetch = await this.providerAdapter.invokeFundamentals(
        'fetchSnapshots',
        [batch],
      );
      const snapshots = snapshotFetch.value;
      const dataSource = await this.providerFactory.getDataSourceByCode(
        snapshotFetch.providerCode,
      );
      if (!dataSource) {
        throw new Error(`Data source ${snapshotFetch.providerCode} not found`);
      }

      if (snapshots.length > 0) {
        const snapshotRecords = snapshots
          .filter((s) => tickerToId.has(s.ticker))
          .map((s) => ({
            symbolId: tickerToId.get(s.ticker)!,
            asOf: new Date(s.asOf),
            pe: s.pe !== undefined ? String(s.pe) : undefined,
            pb: s.pb !== undefined ? String(s.pb) : undefined,
            ps: s.ps !== undefined ? String(s.ps) : undefined,
            roe: s.roe !== undefined ? String(s.roe) : undefined,
            roa: s.roa !== undefined ? String(s.roa) : undefined,
            ev: s.ev !== undefined ? String(s.ev) : undefined,
            eps: s.eps !== undefined ? String(s.eps) : undefined,
            marketCap: s.marketCap !== undefined ? String(s.marketCap) : undefined,
            freeFloat: s.freeFloat !== undefined ? String(s.freeFloat) : undefined,
            sharesOut: s.sharesOut !== undefined ? String(s.sharesOut) : undefined,
            foreignRoom:
              s.foreignRoom !== undefined ? String(s.foreignRoom) : undefined,
            foreignHoldingRoom:
              s.foreignHoldingRoom !== undefined
                ? String(s.foreignHoldingRoom)
                : undefined,
            currentHoldingRatio:
              s.currentHoldingRatio !== undefined
                ? String(s.currentHoldingRatio)
                : undefined,
            maxHoldingRatio:
              s.maxHoldingRatio !== undefined ? String(s.maxHoldingRatio) : undefined,
            avgMatchVolume2w:
              s.avgMatchVolume2w !== undefined ? String(s.avgMatchVolume2w) : undefined,
            sourceId: dataSource.id,
          }));

        const result = await this.upsertService.upsertSnapshots(snapshotRecords);
        totalItems += result.inserted + result.updated;
      }
    }

    this.logger.log(`Fundamentals job completed: ${totalItems} snapshots processed`);
    return totalItems;
  }
}
