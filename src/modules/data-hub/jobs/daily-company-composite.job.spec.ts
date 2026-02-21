import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { DailyCompanyCompositeJob } from './daily-company-composite.job';
import { JobRunService } from '../services/job-run.service';
import { AdvisoryLockService } from '../services/advisory-lock.service';
import { MarketHoursService } from '../services/market-hours.service';
import { UpsertService } from '../services/upsert.service';
import { ProviderFactoryService } from '../providers/provider-factory.service';
import { Symbol } from '../entities';
import { QueueService } from '../../queue/queue.service';
import { SimplizeService } from '../../providers/simplize/simplize.service';

describe('DailyCompanyCompositeJob', () => {
  const upsertResult = (processed: number) => ({
    inserted: processed,
    updated: 0,
    skipped: 0,
    processed,
  });

  it('runs full daily-company composite flow with pagination', async () => {
    const symbolRepository = {
      find: jest.fn().mockResolvedValue([{ id: 10, ticker: 'AAA', isActive: true }]),
    } as unknown as Repository<Symbol>;

    const queueService = {
      addCompanyIntelForeignJob: jest.fn().mockResolvedValue({ queueJobId: 'f-1', dedup: false }),
      addCompanyIntelInsiderJob: jest.fn().mockResolvedValue({ queueJobId: 'i-1', dedup: false }),
    } as unknown as QueueService;

    const simplizeService = {
      getRelatedCompanies: jest
        .fn()
        .mockResolvedValue([{ peerTicker: 'BBB', relationType: 'sector', score: 0.8 }]),
      getSubCompanies: jest
        .fn()
        .mockResolvedValue([{ subsidiaryName: 'AAA Sub', ownershipPercent: 51 }]),
      getCompanyReports: jest
        .fn()
        .mockResolvedValueOnce(
          Array.from({ length: 100 }, (_, index) => ({
            fileUrl: `https://example.com/r-${index}.pdf`,
            title: `Report ${index}`,
            publishedAt: '2026-01-01',
          })),
        )
        .mockResolvedValueOnce([
          {
            fileUrl: 'https://example.com/r-last.pdf',
            title: 'Report last',
            publishedAt: '2026-01-02',
          },
        ]),
      getNewsEvents: jest
        .fn()
        .mockResolvedValueOnce(
          Array.from({ length: 100 }, (_, index) => ({
            url: `https://news.example.com/${index}`,
            title: `News ${index}`,
            publishedAt: '2026-01-01T00:00:00.000Z',
          })),
        )
        .mockResolvedValueOnce([
          {
            url: 'https://news.example.com/last',
            title: 'News last',
            publishedAt: '2026-01-01T00:00:00.000Z',
          },
        ]),
    } as unknown as SimplizeService;

    const upsertService = {
      upsertStockRelatedPeers: jest.fn().mockResolvedValue(upsertResult(1)),
      upsertCompanySubsidiaries: jest.fn().mockResolvedValue(upsertResult(1)),
      upsertCompanyReports: jest.fn().mockResolvedValue(upsertResult(101)),
      upsertNewsArticles: jest.fn().mockResolvedValue(upsertResult(101)),
    } as unknown as UpsertService;

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'schedule.timezone') {
          return 'Asia/Ho_Chi_Minh';
        }
        if (key === 'simplize.reportTypes') {
          return ['annual'];
        }
        if (key === 'simplize.newsTypeIds') {
          return ['event'];
        }
        if (key === 'unified.newsSourceMode') {
          return 'daily-company';
        }
        if (key === 'dataHub.dailyCompanyCompositeConcurrency') {
          return '1';
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    const providerFactory = {
      getDataSourceByCode: jest.fn().mockResolvedValue({ id: 9, code: 'SIMPLIZE_API' }),
    } as unknown as ProviderFactoryService;

    const job = new DailyCompanyCompositeJob(
      {} as JobRunService,
      {} as AdvisoryLockService,
      {} as MarketHoursService,
      upsertService,
      providerFactory,
      queueService,
      configService,
      simplizeService,
      symbolRepository,
    );

    const processed = await (job as any).execute();

    expect(processed).toBeGreaterThan(0);
    expect(queueService.addCompanyIntelForeignJob).toHaveBeenCalledTimes(1);
    expect(queueService.addCompanyIntelInsiderJob).toHaveBeenCalledTimes(1);
    expect(upsertService.upsertStockRelatedPeers).toHaveBeenCalledTimes(1);
    expect(upsertService.upsertCompanySubsidiaries).toHaveBeenCalledTimes(1);
    expect(upsertService.upsertCompanyReports).toHaveBeenCalledTimes(1);
    expect(upsertService.upsertNewsArticles).toHaveBeenCalledTimes(1);

    expect((simplizeService.getCompanyReports as jest.Mock).mock.calls[0][2]).toBe(0);
    expect((simplizeService.getCompanyReports as jest.Mock).mock.calls[1][2]).toBe(1);
    expect((simplizeService.getNewsEvents as jest.Mock).mock.calls[0][2]).toBe(0);
    expect((simplizeService.getNewsEvents as jest.Mock).mock.calls[1][2]).toBe(1);
  });

  it('continues processing when one symbol fails', async () => {
    const symbolRepository = {
      find: jest.fn().mockResolvedValue([
        { id: 10, ticker: 'AAA', isActive: true },
        { id: 11, ticker: 'BBB', isActive: true },
      ]),
    } as unknown as Repository<Symbol>;

    const queueService = {
      addCompanyIntelForeignJob: jest.fn().mockResolvedValue({ queueJobId: 'f-1', dedup: false }),
      addCompanyIntelInsiderJob: jest.fn().mockResolvedValue({ queueJobId: 'i-1', dedup: false }),
    } as unknown as QueueService;

    const simplizeService = {
      getRelatedCompanies: jest
        .fn()
        .mockRejectedValueOnce(new Error('related failed'))
        .mockResolvedValueOnce([{ peerTicker: 'CCC' }]),
      getSubCompanies: jest.fn().mockResolvedValue([]),
      getCompanyReports: jest.fn().mockResolvedValue([]),
      getNewsEvents: jest.fn().mockResolvedValue([]),
    } as unknown as SimplizeService;

    const upsertService = {
      upsertStockRelatedPeers: jest.fn().mockResolvedValue(upsertResult(1)),
      upsertCompanySubsidiaries: jest.fn().mockResolvedValue(upsertResult(0)),
      upsertCompanyReports: jest.fn().mockResolvedValue(upsertResult(0)),
      upsertNewsArticles: jest.fn().mockResolvedValue(upsertResult(0)),
    } as unknown as UpsertService;

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'schedule.timezone') {
          return 'Asia/Ho_Chi_Minh';
        }
        if (key === 'simplize.reportTypes') {
          return [];
        }
        if (key === 'simplize.newsTypeIds') {
          return [];
        }
        if (key === 'unified.newsSourceMode') {
          return 'daily-company';
        }
        if (key === 'dataHub.dailyCompanyCompositeConcurrency') {
          return '1';
        }
        return undefined;
      }),
    } as unknown as ConfigService;

    const providerFactory = {
      getDataSourceByCode: jest.fn().mockResolvedValue({ id: 9, code: 'SIMPLIZE_API' }),
    } as unknown as ProviderFactoryService;

    const job = new DailyCompanyCompositeJob(
      {} as JobRunService,
      {} as AdvisoryLockService,
      {} as MarketHoursService,
      upsertService,
      providerFactory,
      queueService,
      configService,
      simplizeService,
      symbolRepository,
    );

    await expect((job as any).execute()).resolves.toBeGreaterThanOrEqual(0);
    expect(queueService.addCompanyIntelForeignJob).toHaveBeenCalledTimes(2);
    expect(queueService.addCompanyIntelInsiderJob).toHaveBeenCalledTimes(2);
  });
});
