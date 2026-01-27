import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BaseJob } from './base.job';
import { JobRunService } from '../services/job-run.service';
import { AdvisoryLockService } from '../services/advisory-lock.service';
import { MarketHoursService } from '../services/market-hours.service';
import { UpsertService } from '../services/upsert.service';
import { ProviderFactoryService } from '../providers/provider-factory.service';
import { GoldProvider } from '../enums';

@Injectable()
export class GoldJob extends BaseJob {
  protected readonly jobName = 'GoldJob';
  protected readonly logger = new Logger(GoldJob.name);

  constructor(
    jobRunService: JobRunService,
    advisoryLockService: AdvisoryLockService,
    marketHoursService: MarketHoursService,
    private readonly upsertService: UpsertService,
    private readonly providerFactory: ProviderFactoryService,
  ) {
    super(jobRunService, advisoryLockService, marketHoursService);
  }

  @Cron('0 7 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleCron(): Promise<void> {
    await this.runWithLock({}, async () => {
      return this.execute();
    });
  }

  private async execute(): Promise<number> {
    const provider = await this.providerFactory.getGoldProvider();
    if (!provider) {
      this.logger.warn('No gold provider available, skipping...');
      return 0;
    }

    const dataSource = await this.providerFactory.getDataSourceByCode(provider.code);
    if (!dataSource) {
      this.logger.warn(`Data source ${provider.code} not found`);
      return 0;
    }

    const today = new Date();
    let totalItems = 0;

    const providers = [GoldProvider.SJC, GoldProvider.DOJI, GoldProvider.PNJ];

    for (const goldProvider of providers) {
      try {
        const priceData = await provider.fetchGold(goldProvider, today);
        if (priceData) {
          const result = await this.upsertService.upsertGoldPrices([
            {
              provider: goldProvider,
              asOf: new Date(priceData.asOf),
              buy: String(priceData.buy),
              sell: String(priceData.sell),
              raw: priceData.raw,
              sourceId: dataSource.id,
            },
          ]);
          totalItems += result.inserted + result.updated;
        }
      } catch (error: any) {
        this.logger.warn(`Failed to fetch gold price for ${goldProvider}: ${error.message}`);
      }
    }

    this.logger.log(`Gold job completed: ${totalItems} prices processed`);
    return totalItems;
  }
}
