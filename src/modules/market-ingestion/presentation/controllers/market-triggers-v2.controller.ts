import { Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RunQuoteHourlyUseCase } from '../../application/use-cases/run-quote-hourly.use-case';
import { RunDailyCompanyUseCase } from '../../application/use-cases/run-daily-company.use-case';

@ApiTags('Market Triggers V2')
@Controller('v2/triggers/market')
export class MarketTriggersV2Controller {
  constructor(
    private readonly runQuoteHourlyUseCase: RunQuoteHourlyUseCase,
    private readonly runDailyCompanyUseCase: RunDailyCompanyUseCase,
  ) {}

  @Post('quote-hourly')
  async triggerQuoteHourly() {
    return this.run('quote-hourly', async () => {
      await this.runQuoteHourlyUseCase.execute();
    });
  }

  @Post('daily-company')
  async triggerDailyCompany() {
    return this.run('daily-company', async () => {
      await this.runDailyCompanyUseCase.execute();
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
