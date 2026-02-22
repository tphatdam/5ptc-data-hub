import { Controller, Get, HttpCode, HttpStatus, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { InternalApiKeyGuard } from '../../../../common/guards/internal-api-key.guard';
import { RunDailyCompanyUseCase } from '../../application/use-cases/run-daily-company.use-case';
import { RunQuoteHourlyUseCase } from '../../application/use-cases/run-quote-hourly.use-case';
import { RunDailyEodUseCase } from '../../application/use-cases/run-daily-eod.use-case';
import { RunAllTriggersUseCase } from '../../application/use-cases/run-all-triggers.use-case';
import { GetTriggerRunStatusUseCase } from '../../application/use-cases/get-trigger-run-status.use-case';

@ApiTags('Triggers')
@UseGuards(InternalApiKeyGuard)
@Controller('triggers')
export class MarketTriggersController {
  constructor(
    private readonly runQuoteHourlyUseCase: RunQuoteHourlyUseCase,
    private readonly runDailyCompanyUseCase: RunDailyCompanyUseCase,
    private readonly runDailyEodUseCase: RunDailyEodUseCase,
    private readonly runAllTriggersUseCase: RunAllTriggersUseCase,
    private readonly getTriggerRunStatusUseCase: GetTriggerRunStatusUseCase,
  ) {}

  @Get()
  listTriggers(@Res({ passthrough: true }) _res: Response) {
    return {
      triggers: [
        { method: 'POST', path: '/triggers/quote-hourly' },
        { method: 'POST', path: '/triggers/daily-company' },
        { method: 'POST', path: '/triggers/daily-eod' },
        { method: 'POST', path: '/triggers/run-all' },
        { method: 'GET', path: '/triggers/runs/:runId' },
      ],
    };
  }

  @Post('quote-hourly')
  async triggerQuoteHourly(@Res({ passthrough: true }) _res: Response) {
    return this.run('quote-hourly', async () => {
      await this.runQuoteHourlyUseCase.execute();
    });
  }

  @Post('daily-company')
  async triggerDailyCompany(@Res({ passthrough: true }) _res: Response) {
    return this.run('daily-company', async () => {
      await this.runDailyCompanyUseCase.execute();
    });
  }

  @Post('daily-eod')
  async triggerDailyEod(@Res({ passthrough: true }) _res: Response) {
    return this.run('daily-eod', async () => {
      await this.runDailyEodUseCase.execute();
    });
  }

  @HttpCode(HttpStatus.ACCEPTED)
  @Post('run-all')
  async triggerRunAll(@Res({ passthrough: true }) _res: Response) {
    const result = await this.runAllTriggersUseCase.execute();

    return {
      ok: true,
      runId: result.runId,
      status: 'QUEUED',
      acceptedAt: result.acceptedAt,
      mode: result.mode,
    };
  }

  @Get('runs/:runId')
  async getRunStatus(
    @Param('runId') runId: string,
    @Res({ passthrough: true }) _res: Response,
  ) {
    const result = await this.getTriggerRunStatusUseCase.execute(runId);
    return {
      ok: true,
      ...result,
    };
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
