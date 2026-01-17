import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BaseJob } from './base.job';
import { JobRunService } from '../services/job-run.service';
import { AdvisoryLockService } from '../services/advisory-lock.service';
import { MarketHoursService } from '../services/market-hours.service';
import { UpsertService } from '../services/upsert.service';
import { ProviderFactoryService } from '../providers/provider-factory.service';
import { subHours } from 'date-fns';

@Injectable()
export class NewsJob extends BaseJob {
  protected readonly jobName = 'NewsJob';
  protected readonly logger = new Logger(NewsJob.name);

  constructor(
    jobRunService: JobRunService,
    advisoryLockService: AdvisoryLockService,
    marketHoursService: MarketHoursService,
    private readonly upsertService: UpsertService,
    private readonly providerFactory: ProviderFactoryService,
  ) {
    super(jobRunService, advisoryLockService, marketHoursService);
  }

  @Cron('*/15 * * * *')
  async handleCron(): Promise<void> {
    await this.runWithLock({}, async () => {
      return this.execute();
    });
  }

  private async execute(): Promise<number> {
    const provider = await this.providerFactory.getNewsProvider();
    if (!provider) {
      this.logger.warn('No news provider available, skipping...');
      return 0;
    }

    const dataSource = await this.providerFactory.getDataSourceByCode(provider.code);
    if (!dataSource) {
      this.logger.warn(`Data source ${provider.code} not found`);
      return 0;
    }

    const lastSuccess = await this.jobRunService.getLastSuccessTime(this.jobName);
    const since = lastSuccess || subHours(new Date(), 2);

    const articles = await provider.fetchLatest(since);

    if (articles.length === 0) {
      this.logger.debug('No new articles found');
      return 0;
    }

    const articleRecords = articles.map((a) => ({
      sourceId: dataSource.id,
      url: a.url,
      publishedAt: a.publishedAt ? new Date(a.publishedAt) : undefined,
      title: a.title,
      summary: a.summary,
      content: a.content,
      tickers: a.tickers,
      tags: a.tags,
      fetchedAt: new Date(),
    }));

    const result = await this.upsertService.upsertNewsArticles(articleRecords);

    this.logger.log(`News job completed: ${result.inserted + result.updated} articles processed`);
    return result.inserted + result.updated;
  }
}
