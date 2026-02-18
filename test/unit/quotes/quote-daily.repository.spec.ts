import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { QuoteDailyRepository } from '../../../src/modules/quotes/quote-daily.repository';
import { QuoteDaily } from '../../../src/db/entities/quote-daily.entity';

describe('QuoteDailyRepository', () => {
  let quoteDailyRepository: QuoteDailyRepository;
  let mockDataSource: Partial<DataSource>;
  let mockQueryBuilder: Partial<SelectQueryBuilder<QuoteDaily>>;
  let mockRepository: Partial<Repository<QuoteDaily>>;

  beforeEach(async () => {
    // Create mock query builder
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    // Create mock repository
    mockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    // Create mock data source
    mockDataSource = {
      query: jest.fn(),
      getRepository: jest.fn().mockReturnValue(mockRepository),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteDailyRepository,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    quoteDailyRepository =
      module.get<QuoteDailyRepository>(QuoteDailyRepository);
  });

  describe('bulkUpsert', () => {
    it('should return 0 for empty array', async () => {
      const result = await quoteDailyRepository.bulkUpsert([]);

      expect(result).toBe(0);
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it('should upsert quotes in a single chunk when less than 500', async () => {
      const quotes = [
        {
          symbolId: '123e4567-e89b-12d3-a456-426614174000',
          date: new Date('2024-01-15'),
          open: 100.5,
          high: 105.0,
          low: 99.0,
          close: 103.5,
          volume: '1000000',
          source: 'VCI',
        },
        {
          symbolId: '123e4567-e89b-12d3-a456-426614174001',
          date: new Date('2024-01-15'),
          open: 50.0,
          high: 52.0,
          low: 49.5,
          close: 51.5,
          volume: '500000',
          source: 'VCI',
        },
      ];

      (mockDataSource.query as jest.Mock).mockResolvedValue(undefined);

      const result = await quoteDailyRepository.bulkUpsert(quotes);

      expect(result).toBe(2);
      expect(mockDataSource.query).toHaveBeenCalledTimes(1);

      // Verify SQL structure
      const sqlCall = (mockDataSource.query as jest.Mock).mock.calls[0];
      const sql = sqlCall[0];
      const values = sqlCall[1];

      expect(sql).toContain('INSERT INTO quote_daily');
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('DO UPDATE SET');
      expect(values).toHaveLength(16); // 2 quotes * 8 fields each
    });

    it('should chunk quotes into batches of 500', async () => {
      // Create 1200 quotes to test chunking
      const quotes = Array.from({ length: 1200 }, (_, i) => ({
        symbolId: '123e4567-e89b-12d3-a456-426614174000',
        date: new Date('2024-01-15'),
        open: 100.0 + i,
        high: 105.0 + i,
        low: 99.0 + i,
        close: 103.0 + i,
        volume: `${1000000 + i}`,
        source: 'VCI',
      }));

      (mockDataSource.query as jest.Mock).mockResolvedValue(undefined);

      const result = await quoteDailyRepository.bulkUpsert(quotes);

      expect(result).toBe(1200);
      // Should be called 3 times: 500 + 500 + 200
      expect(mockDataSource.query).toHaveBeenCalledTimes(3);

      // Verify first chunk has 500 quotes (500 * 8 = 4000 values)
      const firstChunkValues = (mockDataSource.query as jest.Mock).mock
        .calls[0][1];
      expect(firstChunkValues).toHaveLength(4000);

      // Verify last chunk has 200 quotes (200 * 8 = 1600 values)
      const lastChunkValues = (mockDataSource.query as jest.Mock).mock
        .calls[2][1];
      expect(lastChunkValues).toHaveLength(1600);
    });

    it('should handle exactly 500 quotes in one chunk', async () => {
      const quotes = Array.from({ length: 500 }, (_, i) => ({
        symbolId: '123e4567-e89b-12d3-a456-426614174000',
        date: new Date('2024-01-15'),
        open: 100.0,
        high: 105.0,
        low: 99.0,
        close: 103.0,
        volume: '1000000',
        source: 'VCI',
      }));

      (mockDataSource.query as jest.Mock).mockResolvedValue(undefined);

      const result = await quoteDailyRepository.bulkUpsert(quotes);

      expect(result).toBe(500);
      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
    });

    it('should handle exactly 501 quotes in two chunks', async () => {
      const quotes = Array.from({ length: 501 }, (_, i) => ({
        symbolId: '123e4567-e89b-12d3-a456-426614174000',
        date: new Date('2024-01-15'),
        open: 100.0,
        high: 105.0,
        low: 99.0,
        close: 103.0,
        volume: '1000000',
        source: 'VCI',
      }));

      (mockDataSource.query as jest.Mock).mockResolvedValue(undefined);

      const result = await quoteDailyRepository.bulkUpsert(quotes);

      expect(result).toBe(501);
      expect(mockDataSource.query).toHaveBeenCalledTimes(2);
    });

    it('should throw error when database query fails', async () => {
      const quotes = [
        {
          symbolId: '123e4567-e89b-12d3-a456-426614174000',
          date: new Date('2024-01-15'),
          open: 100.5,
          high: 105.0,
          low: 99.0,
          close: 103.5,
          volume: '1000000',
          source: 'VCI',
        },
      ];

      const dbError = new Error('Database connection failed');
      (mockDataSource.query as jest.Mock).mockRejectedValue(dbError);

      await expect(quoteDailyRepository.bulkUpsert(quotes)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should include all required fields in SQL', async () => {
      const quotes = [
        {
          symbolId: '123e4567-e89b-12d3-a456-426614174000',
          date: new Date('2024-01-15'),
          open: 100.5,
          high: 105.0,
          low: 99.0,
          close: 103.5,
          volume: '1000000',
          source: 'VCI',
        },
      ];

      (mockDataSource.query as jest.Mock).mockResolvedValue(undefined);

      await quoteDailyRepository.bulkUpsert(quotes);

      const sqlCall = (mockDataSource.query as jest.Mock).mock.calls[0];
      const sql = sqlCall[0];

      // Check all fields are in INSERT clause
      expect(sql).toContain('"symbolId"');
      expect(sql).toContain('date');
      expect(sql).toContain('open');
      expect(sql).toContain('high');
      expect(sql).toContain('low');
      expect(sql).toContain('close');
      expect(sql).toContain('volume');
      expect(sql).toContain('source');

      // Check conflict resolution
      expect(sql).toContain('ON CONFLICT ("symbolId", date, source)');
      expect(sql).toContain('DO UPDATE SET');
      expect(sql).toContain('EXCLUDED.open');
      expect(sql).toContain('EXCLUDED.high');
      expect(sql).toContain('EXCLUDED.low');
      expect(sql).toContain('EXCLUDED.close');
      expect(sql).toContain('EXCLUDED.volume');
      expect(sql).toContain('"ingestedAt" = CURRENT_TIMESTAMP');
    });
  });

  describe('findBySymbolAndDateRange', () => {
    it('should find quotes within date range', async () => {
      const symbolId = '123e4567-e89b-12d3-a456-426614174000';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockQuotes = [
        {
          id: '1',
          symbolId,
          date: new Date('2024-01-15'),
          open: 100.5,
          high: 105.0,
          low: 99.0,
          close: 103.5,
          volume: '1000000',
          source: 'VCI',
          ingestedAt: new Date(),
        },
        {
          id: '2',
          symbolId,
          date: new Date('2024-01-16'),
          open: 103.5,
          high: 107.0,
          low: 102.0,
          close: 106.0,
          volume: '1200000',
          source: 'VCI',
          ingestedAt: new Date(),
        },
      ];

      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue(mockQuotes);

      const result = await quoteDailyRepository.findBySymbolAndDateRange(
        symbolId,
        startDate,
        endDate,
      );

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('quote');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'quote.symbolId = :symbolId',
        { symbolId },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'quote.date >= :startDate',
        { startDate },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'quote.date <= :endDate',
        { endDate },
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'quote.date',
        'ASC',
      );
      expect(result).toEqual(mockQuotes);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no quotes found', async () => {
      const symbolId = '123e4567-e89b-12d3-a456-426614174000';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue([]);

      const result = await quoteDailyRepository.findBySymbolAndDateRange(
        symbolId,
        startDate,
        endDate,
      );

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle single day date range', async () => {
      const symbolId = '123e4567-e89b-12d3-a456-426614174000';
      const singleDate = new Date('2024-01-15');

      const mockQuote = {
        id: '1',
        symbolId,
        date: singleDate,
        open: 100.5,
        high: 105.0,
        low: 99.0,
        close: 103.5,
        volume: '1000000',
        source: 'VCI',
        ingestedAt: new Date(),
      };

      (mockQueryBuilder.getMany as jest.Mock).mockResolvedValue([mockQuote]);

      const result = await quoteDailyRepository.findBySymbolAndDateRange(
        symbolId,
        singleDate,
        singleDate,
      );

      expect(result).toHaveLength(1);
      expect(result[0].date).toEqual(singleDate);
    });

    it('should throw error when query fails', async () => {
      const symbolId = '123e4567-e89b-12d3-a456-426614174000';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const dbError = new Error('Database query failed');
      (mockQueryBuilder.getMany as jest.Mock).mockRejectedValue(dbError);

      await expect(
        quoteDailyRepository.findBySymbolAndDateRange(
          symbolId,
          startDate,
          endDate,
        ),
      ).rejects.toThrow('Database query failed');
    });
  });
});
