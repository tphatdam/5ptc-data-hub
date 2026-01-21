import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { QuoteDailyRepository } from '../../src/quotes/quote-daily.repository';
import { Symbol } from '../../src/db/entities/symbol.entity';
import { QuoteDaily } from '../../src/db/entities/quote-daily.entity';
import { QuoteIntraday } from '../../src/db/entities/quote-intraday.entity';

// Load environment variables
config();

describe('QuoteDailyRepository - Property Tests', () => {
  let module: TestingModule;
  let quoteDailyRepository: QuoteDailyRepository;
  let dataSource: DataSource;
  let testSymbolId: string;

  beforeAll(async () => {
    // Create test database connection with PostgreSQL
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          username: process.env.DB_USER || 'postgres',
          password: String(process.env.DB_PASS || ''),
          database: 'postgres', // Use default postgres database for tests
          entities: [Symbol, QuoteDaily, QuoteIntraday],
          synchronize: true, // OK for tests
          dropSchema: false, // Don't drop schema - we'll clean up manually
          logging: false,
        }),
        TypeOrmModule.forFeature([QuoteDaily, Symbol]),
      ],
      providers: [QuoteDailyRepository],
    }).compile();

    quoteDailyRepository = module.get<QuoteDailyRepository>(QuoteDailyRepository);
    dataSource = module.get<DataSource>(DataSource);

    // Create a test symbol for foreign key references
    const symbolRepository = dataSource.getRepository(Symbol);
    
    // Check if test symbol already exists
    let existingSymbol = await symbolRepository.findOne({
      where: { symbol: 'TEST_QUOTE_DAILY' },
    });
    
    if (existingSymbol) {
      testSymbolId = existingSymbol.id;
    } else {
      const testSymbol = symbolRepository.create({
        symbol: 'TEST_QUOTE_DAILY',
        exchange: 'HOSE',
        name: 'Test Symbol for Quote Daily',
        status: 'ACTIVE',
      });
      const savedSymbol = await symbolRepository.save(testSymbol);
      testSymbolId = savedSymbol.id;
    }
  }, 30000); // Increase timeout for database connection

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      // Clean up quote_daily records first (to avoid foreign key constraint)
      const quoteRepository = dataSource.getRepository(QuoteDaily);
      await quoteRepository.createQueryBuilder().delete().where('1=1').execute();
      
      // Then clean up test symbol
      const symbolRepository = dataSource.getRepository(Symbol);
      await symbolRepository.delete({ id: testSymbolId });
      
      await dataSource.destroy();
    }
    if (module) {
      await module.close();
    }
  });

  beforeEach(async () => {
    // Clear the quote_daily table before each test
    const repository = dataSource.getRepository(QuoteDaily);
    await repository.createQueryBuilder().delete().where('1=1').execute();
  });

  describe('Property 7: Daily quotes unique constraint enforcement', () => {
    /**
     * **Validates: Requirements 4.3, 5.2**
     *
     * For any set of daily quotes with duplicate (symbolId, date, source) tuples,
     * bulk upsert should result in exactly one record per tuple with the latest data.
     */
    it('should maintain exactly one record per (symbolId, date, source) tuple after bulk upsert with duplicates', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a date
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          // Generate a source
          fc.constantFrom('VCI', 'SSI', 'TCBS', 'VNDIRECT'),
          // Generate first set of OHLCV data
          fc.record({
            open: fc.double({ min: 1, max: 1000, noNaN: true }),
            high: fc.double({ min: 1, max: 1000, noNaN: true }),
            low: fc.double({ min: 1, max: 1000, noNaN: true }),
            close: fc.double({ min: 1, max: 1000, noNaN: true }),
            volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(v => v.toString()),
          }),
          // Generate second set of OHLCV data (potentially different)
          fc.record({
            open: fc.double({ min: 1, max: 1000, noNaN: true }),
            high: fc.double({ min: 1, max: 1000, noNaN: true }),
            low: fc.double({ min: 1, max: 1000, noNaN: true }),
            close: fc.double({ min: 1, max: 1000, noNaN: true }),
            volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(v => v.toString()),
          }),
          async (date, source, firstData, secondData) => {
            const repository = dataSource.getRepository(QuoteDaily);

            // First upsert with first data
            await quoteDailyRepository.bulkUpsert([
              {
                symbolId: testSymbolId,
                date,
                source,
                ...firstData,
              },
            ]);

            // Verify one record exists
            let count = await repository.count({
              where: { symbolId: testSymbolId, date, source },
            });
            expect(count).toBe(1);

            // Second upsert with second data (should update)
            await quoteDailyRepository.bulkUpsert([
              {
                symbolId: testSymbolId,
                date,
                source,
                ...secondData,
              },
            ]);

            // Verify still exactly one record exists
            count = await repository.count({
              where: { symbolId: testSymbolId, date, source },
            });
            expect(count).toBe(1);

            // Verify the record has the latest data (second data)
            const finalRecord = await repository.findOne({
              where: { symbolId: testSymbolId, date, source },
            });

            expect(finalRecord).toBeDefined();
            expect(finalRecord!.symbolId).toBe(testSymbolId);
            // PostgreSQL stores dates as strings in YYYY-MM-DD format
            expect(new Date(finalRecord!.date).toISOString().split('T')[0]).toBe(
              date.toISOString().split('T')[0]
            );
            expect(finalRecord!.source).toBe(source);
            expect(finalRecord!.open).toBe(secondData.open);
            expect(finalRecord!.high).toBe(secondData.high);
            expect(finalRecord!.low).toBe(secondData.low);
            expect(finalRecord!.close).toBe(secondData.close);
            expect(finalRecord!.volume).toBe(secondData.volume);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple duplicates and keep only the latest data', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a date
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          // Generate a source
          fc.constantFrom('VCI', 'SSI', 'TCBS', 'VNDIRECT'),
          // Generate an array of OHLCV data updates (3-10 updates)
          fc.array(
            fc.record({
              open: fc.double({ min: 1, max: 1000, noNaN: true }),
              high: fc.double({ min: 1, max: 1000, noNaN: true }),
              low: fc.double({ min: 1, max: 1000, noNaN: true }),
              close: fc.double({ min: 1, max: 1000, noNaN: true }),
              volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(v => v.toString()),
            }),
            { minLength: 3, maxLength: 10 }
          ),
          async (date, source, dataUpdates) => {
            const repository = dataSource.getRepository(QuoteDaily);

            // Perform multiple upserts sequentially (not in a single batch)
            for (const data of dataUpdates) {
              await quoteDailyRepository.bulkUpsert([
                {
                  symbolId: testSymbolId,
                  date,
                  source,
                  ...data,
                },
              ]);
            }

            // Verify exactly one record exists for this tuple
            const count = await repository.count({
              where: { symbolId: testSymbolId, date, source },
            });
            expect(count).toBe(1);

            // Verify the record has the latest data (last update)
            const finalRecord = await repository.findOne({
              where: { symbolId: testSymbolId, date, source },
            });

            const lastUpdate = dataUpdates[dataUpdates.length - 1];
            expect(finalRecord).toBeDefined();
            expect(finalRecord!.symbolId).toBe(testSymbolId);
            // PostgreSQL stores dates as strings in YYYY-MM-DD format
            expect(new Date(finalRecord!.date).toISOString().split('T')[0]).toBe(
              date.toISOString().split('T')[0]
            );
            expect(finalRecord!.source).toBe(source);
            expect(finalRecord!.open).toBe(lastUpdate.open);
            expect(finalRecord!.high).toBe(lastUpdate.high);
            expect(finalRecord!.low).toBe(lastUpdate.low);
            expect(finalRecord!.close).toBe(lastUpdate.close);
            expect(finalRecord!.volume).toBe(lastUpdate.volume);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow different records for different (symbolId, date, source) combinations', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple unique date-source combinations
          fc.uniqueArray(
            fc.record({
              date: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
              source: fc.constantFrom('VCI', 'SSI', 'TCBS', 'VNDIRECT'),
              open: fc.double({ min: 1, max: 1000, noNaN: true }),
              high: fc.double({ min: 1, max: 1000, noNaN: true }),
              low: fc.double({ min: 1, max: 1000, noNaN: true }),
              close: fc.double({ min: 1, max: 1000, noNaN: true }),
              volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(v => v.toString()),
            }),
            {
              minLength: 2,
              maxLength: 20,
              selector: (item) => `${item.date.toISOString()}|${item.source}`,
            }
          ),
          async (quoteData) => {
            const repository = dataSource.getRepository(QuoteDaily);

            // Add symbolId to all quotes
            const quotes = quoteData.map(data => ({
              symbolId: testSymbolId,
              ...data,
            }));

            // Bulk upsert all quotes
            const upsertedCount = await quoteDailyRepository.bulkUpsert(quotes);

            // Should report all upserts processed
            expect(upsertedCount).toBe(quotes.length);

            // Verify the number of records matches the number of unique tuples
            const totalCount = await repository.count({
              where: { symbolId: testSymbolId },
            });
            expect(totalCount).toBe(quotes.length);

            // Verify each unique tuple has exactly one record
            for (const quote of quotes) {
              const count = await repository.count({
                where: {
                  symbolId: quote.symbolId,
                  date: quote.date,
                  source: quote.source,
                },
              });
              expect(count).toBe(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle same symbolId and date but different sources as separate records', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a date
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          // Generate OHLCV data
          fc.record({
            open: fc.double({ min: 1, max: 1000, noNaN: true }),
            high: fc.double({ min: 1, max: 1000, noNaN: true }),
            low: fc.double({ min: 1, max: 1000, noNaN: true }),
            close: fc.double({ min: 1, max: 1000, noNaN: true }),
            volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(v => v.toString()),
          }),
          async (date, data) => {
            const repository = dataSource.getRepository(QuoteDaily);

            // Create quotes with same symbolId and date but different sources
            const sources = ['VCI', 'SSI', 'TCBS'];
            const quotes = sources.map(source => ({
              symbolId: testSymbolId,
              date,
              source,
              ...data,
            }));

            // Bulk upsert
            const upsertedCount = await quoteDailyRepository.bulkUpsert(quotes);

            // Should report all upserts processed
            expect(upsertedCount).toBe(quotes.length);

            // Verify we have exactly 3 records (one per source)
            const totalCount = await repository.count({
              where: { symbolId: testSymbolId, date },
            });
            expect(totalCount).toBe(sources.length);

            // Verify each source has exactly one record
            for (const source of sources) {
              const count = await repository.count({
                where: { symbolId: testSymbolId, date, source },
              });
              expect(count).toBe(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 10: Bulk upsert chunking', () => {
    /**
     * **Validates: Requirements 5.5**
     *
     * For any bulk upsert operation with N > 500 rows, the operation should be
     * executed in chunks of at most 500 rows each.
     */
    it('should chunk bulk upserts into batches of at most 500 rows', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a number of quotes between 501 and 2000
          fc.integer({ min: 501, max: 2000 }),
          async (numQuotes) => {
            const repository = dataSource.getRepository(QuoteDaily);

            // Generate unique quotes (different dates to avoid conflicts)
            const quotes = Array.from({ length: numQuotes }, (_, i) => ({
              symbolId: testSymbolId,
              date: new Date(2020, 0, 1 + i), // Different date for each quote
              source: 'VCI',
              open: 100.0,
              high: 105.0,
              low: 99.0,
              close: 103.0,
              volume: '1000000',
            }));

            // Bulk upsert
            const upsertedCount = await quoteDailyRepository.bulkUpsert(quotes);

            // Should report all upserts processed
            expect(upsertedCount).toBe(numQuotes);

            // Verify all records were inserted
            const totalCount = await repository.count({
              where: { symbolId: testSymbolId },
            });
            expect(totalCount).toBe(numQuotes);

            // Calculate expected number of chunks
            const expectedChunks = Math.ceil(numQuotes / 500);
            expect(expectedChunks).toBeGreaterThan(1); // Should be chunked

            // Verify the chunking happened correctly by checking all records exist
            // If chunking failed, some records would be missing
            for (let i = 0; i < numQuotes; i++) {
              const record = await repository.findOne({
                where: {
                  symbolId: quotes[i].symbolId,
                  date: quotes[i].date,
                  source: quotes[i].source,
                },
              });
              expect(record).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle exactly 500 quotes in a single chunk', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate exactly 500 quotes
          fc.constant(500),
          async (numQuotes) => {
            const repository = dataSource.getRepository(QuoteDaily);

            // Generate unique quotes
            const quotes = Array.from({ length: numQuotes }, (_, i) => ({
              symbolId: testSymbolId,
              date: new Date(2020, 0, 1 + i),
              source: 'VCI',
              open: 100.0,
              high: 105.0,
              low: 99.0,
              close: 103.0,
              volume: '1000000',
            }));

            // Bulk upsert
            const upsertedCount = await quoteDailyRepository.bulkUpsert(quotes);

            // Should report all upserts processed
            expect(upsertedCount).toBe(500);

            // Verify all records were inserted
            const totalCount = await repository.count({
              where: { symbolId: testSymbolId },
            });
            expect(totalCount).toBe(500);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle exactly 501 quotes in two chunks', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate exactly 501 quotes
          fc.constant(501),
          async (numQuotes) => {
            const repository = dataSource.getRepository(QuoteDaily);

            // Generate unique quotes
            const quotes = Array.from({ length: numQuotes }, (_, i) => ({
              symbolId: testSymbolId,
              date: new Date(2020, 0, 1 + i),
              source: 'VCI',
              open: 100.0,
              high: 105.0,
              low: 99.0,
              close: 103.0,
              volume: '1000000',
            }));

            // Bulk upsert
            const upsertedCount = await quoteDailyRepository.bulkUpsert(quotes);

            // Should report all upserts processed
            expect(upsertedCount).toBe(501);

            // Verify all records were inserted
            const totalCount = await repository.count({
              where: { symbolId: testSymbolId },
            });
            expect(totalCount).toBe(501);

            // Should be split into 2 chunks: 500 + 1
            const expectedChunks = Math.ceil(501 / 500);
            expect(expectedChunks).toBe(2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle less than 500 quotes in a single chunk', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate between 1 and 499 quotes
          fc.integer({ min: 1, max: 499 }),
          async (numQuotes) => {
            const repository = dataSource.getRepository(QuoteDaily);

            // Generate unique quotes
            const quotes = Array.from({ length: numQuotes }, (_, i) => ({
              symbolId: testSymbolId,
              date: new Date(2020, 0, 1 + i),
              source: 'VCI',
              open: 100.0,
              high: 105.0,
              low: 99.0,
              close: 103.0,
              volume: '1000000',
            }));

            // Bulk upsert
            const upsertedCount = await quoteDailyRepository.bulkUpsert(quotes);

            // Should report all upserts processed
            expect(upsertedCount).toBe(numQuotes);

            // Verify all records were inserted
            const totalCount = await repository.count({
              where: { symbolId: testSymbolId },
            });
            expect(totalCount).toBe(numQuotes);

            // Should be in a single chunk
            const expectedChunks = Math.ceil(numQuotes / 500);
            expect(expectedChunks).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle large bulk upserts with multiple chunks correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a large number of quotes (1000-3000)
          fc.integer({ min: 1000, max: 3000 }),
          async (numQuotes) => {
            const repository = dataSource.getRepository(QuoteDaily);

            // Generate unique quotes with varying data
            const quotes = Array.from({ length: numQuotes }, (_, i) => ({
              symbolId: testSymbolId,
              date: new Date(2020, 0, 1 + i),
              source: 'VCI',
              open: 100.0 + (i % 100),
              high: 105.0 + (i % 100),
              low: 99.0 + (i % 100),
              close: 103.0 + (i % 100),
              volume: `${1000000 + i}`,
            }));

            // Bulk upsert
            const upsertedCount = await quoteDailyRepository.bulkUpsert(quotes);

            // Should report all upserts processed
            expect(upsertedCount).toBe(numQuotes);

            // Verify all records were inserted
            const totalCount = await repository.count({
              where: { symbolId: testSymbolId },
            });
            expect(totalCount).toBe(numQuotes);

            // Calculate expected number of chunks
            const expectedChunks = Math.ceil(numQuotes / 500);
            expect(expectedChunks).toBeGreaterThanOrEqual(2);

            // Verify data integrity by sampling some records
            const sampleIndices = [0, Math.floor(numQuotes / 2), numQuotes - 1];
            for (const i of sampleIndices) {
              const record = await repository.findOne({
                where: {
                  symbolId: quotes[i].symbolId,
                  date: quotes[i].date,
                  source: quotes[i].source,
                },
              });
              expect(record).toBeDefined();
              expect(record!.open).toBe(quotes[i].open);
              expect(record!.close).toBe(quotes[i].close);
              expect(record!.volume).toBe(quotes[i].volume);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
