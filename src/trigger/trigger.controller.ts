import { Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { InternalApiKeyGuard } from '../common/guards/internal-api-key.guard';
import { RunDailyCompanyUseCase } from '../modules/market-ingestion/application/use-cases/run-daily-company.use-case';
import { RunQuoteHourlyUseCase } from '../modules/market-ingestion/application/use-cases/run-quote-hourly.use-case';

const V1_SUNSET_DATE = '2026-08-31';

@ApiTags('Triggers')
@UseGuards(InternalApiKeyGuard)
@Controller('triggers')
export class TriggerController {
  constructor(
    private readonly runQuoteHourlyUseCase: RunQuoteHourlyUseCase,
    private readonly runDailyCompanyUseCase: RunDailyCompanyUseCase,
  ) {}

  @Get()
  listTriggers(@Res({ passthrough: true }) res: Response) {
    this.applyDeprecationHeaders(res);

    return {
      triggers: [
        { method: 'POST', path: '/triggers/ingestion/quote-hourly' },
        { method: 'POST', path: '/triggers/ingestion/daily-company' },
      ],
    };
  }

  @Post('ingestion/quote-hourly')
  async triggerQuoteHourly(@Res({ passthrough: true }) res: Response) {
    this.applyDeprecationHeaders(res);
    return this.run('quote-hourly', async () => {
      await this.runQuoteHourlyUseCase.execute();
    });
  }

  @Post('ingestion/daily-company')
  async triggerDailyCompany(@Res({ passthrough: true }) res: Response) {
    this.applyDeprecationHeaders(res);
    return this.run('daily-company', async () => {
      await this.runDailyCompanyUseCase.execute();
    });
  }

  private applyDeprecationHeaders(res: Response): void {
    res.setHeader('x-api-deprecated', 'true');
    res.setHeader('sunset', V1_SUNSET_DATE);
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
