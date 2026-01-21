import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CrawlRunsRepository } from '../../../src/ingestion/crawl-runs.repository';
import { CrawlRun, CrawlRunStatus } from '../../../src/db/entities/crawl-run.entity';
import { Repository } from 'typeorm';

describe('CrawlRunsRepository', () => {
  let crawlRunsRepository: CrawlRunsRepository;
  let mockRepository: Partial<Repository<CrawlRun>>;

  beforeEach(async () => {
    // Create mock repository
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrawlRunsRepository,
        {
          provide: getRepositoryToken(CrawlRun),
          useValue: mockRepository,
        },
      ],
    }).compile();

    crawlRunsRepository = module.get<CrawlRunsRepository>(CrawlRunsRepository);
  });

  describe('createRun', () => {
    it('should create a new crawl run with RUNNING status', async () => {
      const createData = {
        jobName: 'intraday-15m',
        source: 'VCI',
      };

      const mockCrawlRun = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        jobName: 'intraday-15m',
        source: 'VCI',
        startedAt: new Date(),
        status: CrawlRunStatus.RUNNING,
        endedAt: null,
        errorText: null,
        statsJson: null,
      };

      (mockRepository.create as jest.Mock).mockReturnValue(mockCrawlRun);
      (mockRepository.save as jest.Mock).mockResolvedValue(mockCrawlRun);

      const result = await crawlRunsRepository.createRun(createData);

      expect(mockRepository.create).toHaveBeenCalledWith({
        jobName: 'intraday-15m',
        source: 'VCI',
        startedAt: expect.any(Date),
        status: CrawlRunStatus.RUNNING,
        endedAt: null,
        errorText: null,
        statsJson: null,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockCrawlRun);
      expect(result.status).toBe(CrawlRunStatus.RUNNING);
      expect(result.jobName).toBe('intraday-15m');
      expect(result.source).toBe('VCI');
    });

    it('should throw error when save fails', async () => {
      const createData = {
        jobName: 'daily-eod',
        source: 'VCI',
      };

      (mockRepository.create as jest.Mock).mockReturnValue({});
      (mockRepository.save as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(crawlRunsRepository.createRun(createData)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('markSuccess', () => {
    it('should update crawl run to SUCCESS status with stats', async () => {
      const runId = '123e4567-e89b-12d3-a456-426614174000';
      const stats = {
        symbolsCount: 10,
        rowsUpserted: 150,
        durationMs: 5000,
      };

      (mockRepository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await crawlRunsRepository.markSuccess(runId, stats);

      expect(mockRepository.update).toHaveBeenCalledWith(runId, {
        status: CrawlRunStatus.SUCCESS,
        endedAt: expect.any(Date),
        statsJson: stats,
      });
    });

    it('should throw error when crawl run not found', async () => {
      const runId = 'non-existent-id';
      const stats = {
        symbolsCount: 10,
        rowsUpserted: 150,
        durationMs: 5000,
      };

      (mockRepository.update as jest.Mock).mockResolvedValue({ affected: 0 });

      await expect(
        crawlRunsRepository.markSuccess(runId, stats),
      ).rejects.toThrow(`Crawl run ${runId} not found`);
    });

    it('should handle update errors', async () => {
      const runId = '123e4567-e89b-12d3-a456-426614174000';
      const stats = {
        symbolsCount: 10,
        rowsUpserted: 150,
        durationMs: 5000,
      };

      (mockRepository.update as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        crawlRunsRepository.markSuccess(runId, stats),
      ).rejects.toThrow('Database error');
    });
  });

  describe('markFailed', () => {
    it('should update crawl run to FAILED status with error text', async () => {
      const runId = '123e4567-e89b-12d3-a456-426614174000';
      const errorText = 'Provider timeout';

      (mockRepository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await crawlRunsRepository.markFailed(runId, errorText);

      expect(mockRepository.update).toHaveBeenCalledWith(runId, {
        status: CrawlRunStatus.FAILED,
        endedAt: expect.any(Date),
        errorText: 'Provider timeout',
        statsJson: null,
      });
    });

    it('should update crawl run with partial stats', async () => {
      const runId = '123e4567-e89b-12d3-a456-426614174000';
      const errorText = 'Database connection lost';
      const partialStats = {
        symbolsCount: 10,
        durationMs: 3000,
      };

      (mockRepository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await crawlRunsRepository.markFailed(runId, errorText, partialStats);

      expect(mockRepository.update).toHaveBeenCalledWith(runId, {
        status: CrawlRunStatus.FAILED,
        endedAt: expect.any(Date),
        errorText: 'Database connection lost',
        statsJson: partialStats,
      });
    });

    it('should throw error when crawl run not found', async () => {
      const runId = 'non-existent-id';
      const errorText = 'Some error';

      (mockRepository.update as jest.Mock).mockResolvedValue({ affected: 0 });

      await expect(
        crawlRunsRepository.markFailed(runId, errorText),
      ).rejects.toThrow(`Crawl run ${runId} not found`);
    });

    it('should handle update errors', async () => {
      const runId = '123e4567-e89b-12d3-a456-426614174000';
      const errorText = 'Some error';

      (mockRepository.update as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        crawlRunsRepository.markFailed(runId, errorText),
      ).rejects.toThrow('Database error');
    });
  });

  describe('getRecentRuns', () => {
    it('should return recent runs ordered by startedAt descending', async () => {
      const mockRuns = [
        {
          id: '1',
          jobName: 'intraday-15m',
          source: 'VCI',
          startedAt: new Date('2024-01-15T10:30:00Z'),
          endedAt: new Date('2024-01-15T10:35:00Z'),
          status: CrawlRunStatus.SUCCESS,
          errorText: null,
          statsJson: { symbolsCount: 10, rowsUpserted: 150, durationMs: 5000 },
        },
        {
          id: '2',
          jobName: 'intraday-15m',
          source: 'VCI',
          startedAt: new Date('2024-01-15T10:15:00Z'),
          endedAt: new Date('2024-01-15T10:20:00Z'),
          status: CrawlRunStatus.SUCCESS,
          errorText: null,
          statsJson: { symbolsCount: 10, rowsUpserted: 145, durationMs: 4800 },
        },
      ];

      (mockRepository.find as jest.Mock).mockResolvedValue(mockRuns);

      const result = await crawlRunsRepository.getRecentRuns('intraday-15m', 10);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { jobName: 'intraday-15m' },
        order: { startedAt: 'DESC' },
        take: 10,
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
    });

    it('should respect the limit parameter', async () => {
      const mockRuns = [
        {
          id: '1',
          jobName: 'daily-eod',
          source: 'VCI',
          startedAt: new Date('2024-01-15T18:05:00Z'),
          endedAt: new Date('2024-01-15T18:10:00Z'),
          status: CrawlRunStatus.SUCCESS,
          errorText: null,
          statsJson: { symbolsCount: 50, rowsUpserted: 50, durationMs: 10000 },
        },
      ];

      (mockRepository.find as jest.Mock).mockResolvedValue(mockRuns);

      const result = await crawlRunsRepository.getRecentRuns('daily-eod', 5);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { jobName: 'daily-eod' },
        order: { startedAt: 'DESC' },
        take: 5,
      });
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no runs found', async () => {
      (mockRepository.find as jest.Mock).mockResolvedValue([]);

      const result = await crawlRunsRepository.getRecentRuns('non-existent-job', 10);

      expect(result).toHaveLength(0);
    });

    it('should handle find errors', async () => {
      (mockRepository.find as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        crawlRunsRepository.getRecentRuns('intraday-15m', 10),
      ).rejects.toThrow('Database error');
    });
  });
});
