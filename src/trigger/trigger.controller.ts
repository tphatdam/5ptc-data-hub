import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IngestionService } from '../ingestion/ingestion.service';
import { InternalApiKeyGuard } from '../common/guards/internal-api-key.guard';
import {
  EodDailyJob,
  FundamentalsJob,
  GapFillJob,
  GoldJob,
  IntradayMarketJob,
  NewsJob,
  SymbolSyncJob,
} from '../data-hub/jobs';

@ApiTags('Triggers')
@UseGuards(InternalApiKeyGuard)
@Controller('triggers')
export class TriggerController {
  constructor(
    private readonly ingestionService: IngestionService,
    private readonly intradayMarketJob: IntradayMarketJob,
    private readonly eodDailyJob: EodDailyJob,
    private readonly fundamentalsJob: FundamentalsJob,
    private readonly goldJob: GoldJob,
    private readonly newsJob: NewsJob,
    private readonly symbolSyncJob: SymbolSyncJob,
    private readonly gapFillJob: GapFillJob,
  ) {}

  @Get()
  listTriggers() {
    return {
      triggers: [
        { method: 'POST', path: '/triggers/ingestion/quote-hourly' },
        { method: 'POST', path: '/triggers/ingestion/daily-company' },
        { method: 'POST', path: '/triggers/data-hub/intraday-market' },
        { method: 'POST', path: '/triggers/data-hub/eod-daily' },
        { method: 'POST', path: '/triggers/data-hub/fundamentals' },
        { method: 'POST', path: '/triggers/data-hub/gold' },
        { method: 'POST', path: '/triggers/data-hub/news' },
        { method: 'POST', path: '/triggers/data-hub/symbol-sync' },
        { method: 'POST', path: '/triggers/data-hub/gap-fill' },
      ],
    };
  }

  @Post('ingestion/quote-hourly')
  async triggerQuoteHourly() {
    return this.run('quote-hourly', async () => {
      await this.ingestionService.runQuoteHourly();
    });
  }

  @Post('ingestion/daily-company')
  async triggerDailyCompany() {
    return this.run('daily-company', async () => {
      await this.ingestionService.runDailyCompany();
    });
  }

  @Post('data-hub/intraday-market')
  async triggerIntradayMarket() {
    return this.run('IntradayMarketJob', async () => {
      await this.intradayMarketJob.handleCron();
    });
  }

  @Post('data-hub/eod-daily')
  async triggerEodDaily() {
    return this.run('EodDailyJob', async () => {
      await this.eodDailyJob.handleCron();
    });
  }

  @Post('data-hub/fundamentals')
  async triggerFundamentals() {
    return this.run('FundamentalsJob', async () => {
      await this.fundamentalsJob.handleCron();
    });
  }

  @Post('data-hub/gold')
  async triggerGold() {
    return this.run('GoldJob', async () => {
      await this.goldJob.handleCron();
    });
  }

  @Post('data-hub/news')
  async triggerNews() {
    return this.run('NewsJob', async () => {
      await this.newsJob.handleCron();
    });
  }

  @Post('data-hub/symbol-sync')
  async triggerSymbolSync() {
    return this.run('SymbolSyncJob', async () => {
      await this.symbolSyncJob.handleCron();
    });
  }

  @Post('data-hub/gap-fill')
  async triggerGapFill() {
    return this.run('GapFillJob', async () => {
      await this.gapFillJob.handleCron();
    });
  }

  private async run(job: string, executor: () => Promise<void>) {
    const startedAt = new Date();
    await executor();
    const finishedAt = new Date();

    return {
      ok: true,
      job,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    };
  }
}

