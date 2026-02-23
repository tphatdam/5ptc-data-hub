import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobRun, Symbol, StockCandle, IndexCandle } from './entities';
import { JobStatus } from './enums';
import { MarketHoursService } from './services/market-hours.service';
import { JobRunService } from './services/job-run.service';

@ApiTags('Data Hub')
@Controller('data-hub')
export class DataHubController {
  constructor(
    @InjectRepository(JobRun)
    private readonly jobRunRepository: Repository<JobRun>,
    @InjectRepository(Symbol)
    private readonly symbolRepository: Repository<Symbol>,
    @InjectRepository(StockCandle)
    private readonly stockCandleRepository: Repository<StockCandle>,
    @InjectRepository(IndexCandle)
    private readonly indexCandleRepository: Repository<IndexCandle>,
    private readonly marketHoursService: MarketHoursService,
    private readonly jobRunService: JobRunService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check for data hub' })
  @ApiResponse({ status: 200, description: 'Data hub is healthy' })
  async health() {
    const isTradingTime = this.marketHoursService.isTradingTime();
    const nextBoundary = this.marketHoursService.nextBoundary();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      trading: {
        isTradingTime,
        nextBoundary: {
          type: nextBoundary.type,
          time: nextBoundary.time.toISOString(),
        },
      },
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get data hub metrics' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  async metrics() {
    const [symbolCount, stockCandleCount, indexCandleCount] = await Promise.all([
      this.symbolRepository.count({ where: { isActive: true } }),
      this.stockCandleRepository.count(),
      this.indexCandleRepository.count(),
    ]);

    return {
      symbols: {
        active: symbolCount,
      },
      candles: {
        stock: stockCandleCount,
        index: indexCandleCount,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('jobs/status')
  @ApiOperation({ summary: 'Get status of all jobs' })
  @ApiResponse({ status: 200, description: 'Job statuses retrieved' })
  async jobStatus() {
    const jobNames = [
      'IntradayMarketJob',
      'EodDailyJob',
      'FundamentalsJob',
      'GoldJob',
      'NewsJob',
      'SymbolSyncJob',
      'GapFillJob',
      'DailyCompanyCompositeJob',
    ];

    const statuses = await Promise.all(
      jobNames.map(async (jobName) => {
        const lastSuccess = await this.jobRunService.getLastSuccessTime(jobName);
        const lastRun = await this.jobRunRepository.findOne({
          where: { jobName },
          order: { startedAt: 'DESC' },
        });

        return {
          name: jobName,
          lastRun: lastRun
            ? {
                status: lastRun.status,
                startedAt: lastRun.startedAt,
                finishedAt: lastRun.finishedAt,
                items: lastRun.items,
                error: lastRun.error,
              }
            : null,
          lastSuccessAt: lastSuccess,
        };
      })
    );

    return {
      jobs: statuses,
      timestamp: new Date().toISOString(),
    };
  }
}
