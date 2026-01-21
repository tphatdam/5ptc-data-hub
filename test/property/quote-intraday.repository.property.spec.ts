import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { QuoteIntradayRepository } from '../../src/quotes/quote-intraday.repository';
import { Symbol } from '../../src/db/entities/symbol.entity';
import { QuoteDaily } from '../../src/db/entities/quote-daily.entity';
import { QuoteIntraday } from '../../src/db/entities/quote-intraday.entity';

// Load environment variables
config();

describe('QuoteIntradayRepository - Property Tests', () => {
  let module: TestingModule;
  let quoteIntradayRepository: QuoteIntradayRepository;
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
        TypeOrmModule.forFeature([QuoteIntraday, Symbol]),
      ],
      providers: [QuoteIntradayRepository],
    }).compile();

    quoteIntradayRepository = module.get<QuoteIntradayRepository>(QuoteIntradayRepository);
    dataSource = module.get<DataSource>(DataSource);

    // Create a test symbol for foreign key references
    const symbolRepository = dataSource.getRepository(Symbol);
    
    // Check if test symbol already exists
    let existingSymbol = await symbolRepository.findOne({
      where: { symbol: 'TEST_QUOTE_INTRADAY' },
    });
    
    if (existingSymbol) {
      testSymbolId = existingSymbol.id;
    } else {
      const testSymbol = symbolRepository.create({
        symbol: 'TEST_QUOTE_INTRADAY',
        exchange: 'HOSE',
        name: 'Test Symbol for Quote Intraday',
        status: 'ACTIVE',
      });
      const savedSymbol = await symbolRepository.save(testSymbol);
      testSymbolId = savedSymbol.id;
    }
  }, 30000); // Increase timeout for database connection

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      // Clean up quote_intraday records first (to avoid foreign key constraint)
      const quoteRepository = dataSource.getRepository(QuoteIntraday);
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
    // Clear the quote_intraday table before each test (only for test symbol)
    const repository = dataSource.getRepository(QuoteIntraday);
    await repository.delete({ symbolId: testSymbolId });
  });

  describe('Property 8: Intraday quotes unique constraint enforcement', () => {
    /**
     * **Validates: Requirements 4.6, 5.3**
     *
     * For any set of intraday quotes with duplicate (symbolId, ts, source) tuples,
     * bulk upsert should result in exactly one record per tuple with the latest data.
     */
    it('should maintain exactly one record per (symbolId, ts, source) tuple after bulk upsert with duplicates', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a timestamp
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          // Generate a source
          fc.constantFrom('VCI', 'SSI', 'TCBS', 'VNDIRECT'),
          // Generate first set of price/volume data
          fc.record({
            price: fc.double({ min: 1, max: 1000, noNaN: true }),
            volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(v => v.toString()),
          }),
          // Generate second set of price/volume data (potentially different)
          fc.record({
            price: fc.double({ min: 1, max: 1000, noNaN: true }),
            volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(v => v.toString()),
          }),
          async (ts, source, firstData, secondData) => {
            const repository = dataSource.getRepository(QuoteIntraday);

            // First upsert with first data
            await quoteIntradayRepository.bulkUpsert([
              {
                symbolId: testSymbolId,
                ts,
                source,
                ...firstData,
              },
            ]);

            // Verify one record exists
            let count = await repository.count({
              where: { symbolId: testSymbolId, ts, source },
            });
            expect(count).toBe(1);

            // Second upsert with second data (should update)
            await quoteIntradayRepository.bulkUpsert([
              {
                symbolId: testSymbolId,
                ts,
                source,
                ...secondData,
              },
            ]);

            // Verify still exactly one record exists
            count = await repository.count({
              where: { symbolId: testSymbolId, ts, source },
            });
            expect(count).toBe(1);

            // Verify the record has the latest data (second data)
            const finalRecord = await repository.findOne({
              where: { symbolId: testSymbolId, ts, source },
            });

            expect(finalRecord).toBeDefined();
            expect(finalRecord!.symbolId).toBe(testSymbolId);
            // Compare timestamps (PostgreSQL stores timestamptz)
            expect(new Date(finalRecord!.ts).getTime()).toBe(ts.getTime());
            expect(finalRecord!.source).toBe(source);
            expect(finalRecord!.price).toBe(secondData.price);
            expect(finalRecord!.volume).toBe(secondData.volume);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple duplicates and keep only the latest data', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a timestamp
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          // Generate a source
          fc.constantFrom('VCI', 'SSI', 'TCBS', 'VNDIRECT'),
          // Generate an array of price/volume data updates (3-10 updates)
          fc.array(
            fc.record({
              price: fc.double({ min: 1, max: 1000, noNaN: true }),
              volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(v => v.toString()),
            }),
            { minLength: 3, maxLength: 10 }
          ),
          async (ts, source, dataUpdates) => {
            const repository = dataSource.getRepository(QuoteIntraday);

            // Perform multiple upserts sequentially (not in a single batch)
            for (const data of dataUpdates) {
              await quoteIntradayRepository.bulkUpsert([
                {
                  symbolId: testSymbolId,
                  ts,
                  source,
                  ...data,
                },
              ]);
            }

            // Verify exactly one record exists for this tuple
            const count = await repository.count({
              where: { symbolId: testSymbolId, ts, source },
            });
            expect(count).toBe(1);

            // Verify the record has the latest data (last update)
            const finalRecord = await repository.findOne({
              where: { symbolId: testSymbolId, ts, source },
            });

            const lastUpdate = dataUpdates[dataUpdates.length - 1];
            expect(finalRecord).toBeDefined();
            expect(finalRecord!.symbolId).toBe(testSymbolId);
            // Compare timestamps
            expect(new Date(finalRecord!.ts).getTime()).toBe(ts.getTime());
            expect(finalRecord!.source).toBe(source);
            expect(finalRecord!.price).toBe(lastUpdate.price);
            expect(finalRecord!.volume).toBe(lastUpdate.volume);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow different records for different (symbolId, ts, source) combinations', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple unique timestamp-source combinations
          fc.uniqueArray(
            fc.record({
              ts: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
              source: fc.constantFrom('VCI', 'SSI', 'TCBS', 'VNDIRECT'),
              price: fc.double({ min: 1, max: 1000, noNaN: true }),
              volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(v => v.toString()),
            }),
            {
              minLength: 2,
              maxLength: 20,
              selector: (item) => `${item.ts.getTime()}|${item.source}`,
            }
          ),
          async (quoteData) => {
            const repository = dataSource.getRepository(QuoteIntraday);

            // Clean up before this iteration
            await repository.delete({ symbolId: testSymbolId });

            // Add symbolId to all quotes
            const quotes = quoteData.map(data => ({
              symbolId: testSymbolId,
              ...data,
            }));

            // Bulk upsert all quotes
            const upsertedCount = await quoteIntradayRepository.bulkUpsert(quotes);

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
                  ts: quote.ts,
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

    it('should handle same symbolId and timestamp but different sources as separate records', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a timestamp
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          // Generate price/volume data
          fc.record({
            price: fc.double({ min: 1, max: 1000, noNaN: true }),
            volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(v => v.toString()),
          }),
          async (ts, data) => {
            const repository = dataSource.getRepository(QuoteIntraday);

            // Create quotes with same symbolId and timestamp but different sources
            const sources = ['VCI', 'SSI', 'TCBS'];
            const quotes = sources.map(source => ({
              symbolId: testSymbolId,
              ts,
              source,
              ...data,
            }));

            // Bulk upsert
            const upsertedCount = await quoteIntradayRepository.bulkUpsert(quotes);

            // Should report all upserts processed
            expect(upsertedCount).toBe(quotes.length);

            // Verify we have exactly 3 records (one per source)
            const totalCount = await repository.count({
              where: { symbolId: testSymbolId, ts },
            });
            expect(totalCount).toBe(sources.length);

            // Verify each source has exactly one record
            for (const source of sources) {
              const count = await repository.count({
                where: { symbolId: testSymbolId, ts, source },
              });
              expect(count).toBe(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle quotes with millisecond precision timestamps', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a base timestamp
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          // Generate millisecond offset
          fc.integer({ min: 0, max: 999 }),
          // Generate a source
          fc.constantFrom('VCI', 'SSI', 'TCBS', 'VNDIRECT'),
          // Generate price/volume data
          fc.record({
            price: fc.double({ min: 1, max: 1000, noNaN: true }),
            volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(v => v.toString()),
          }),
          async (baseTs, millisOffset, source, data) => {
            const repository = dataSource.getRepository(QuoteIntraday);

            // Create timestamp with specific milliseconds
            const ts = new Date(baseTs.getTime());
            ts.setMilliseconds(millisOffset);

            // Upsert quote
            await quoteIntradayRepository.bulkUpsert([
              {
                symbolId: testSymbolId,
                ts,
                source,
                ...data,
              },
            ]);

            // Verify record exists
            const count = await repository.count({
              where: { symbolId: testSymbolId, source },
            });
            expect(count).toBeGreaterThanOrEqual(1);

            // Verify the timestamp precision is preserved
            const record = await repository.findOne({
              where: { symbolId: testSymbolId, ts, source },
            });

            expect(record).toBeDefined();
            expect(new Date(record!.ts).getTime()).toBe(ts.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle quotes with same timestamp but different milliseconds as separate records', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a base timestamp (without milliseconds)
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          // Generate a source
          fc.constantFrom('VCI', 'SSI', 'TCBS', 'VNDIRECT'),
          // Generate price/volume data
          fc.record({
            price: fc.double({ min: 1, max: 1000, noNaN: true }),
            volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(v => v.toString()),
          }),
          async (baseTs, source, data) => {
            const repository = dataSource.getRepository(QuoteIntraday);

            // Clean up before this iteration
            await repository.delete({ symbolId: testSymbolId });

            // Create three timestamps with different milliseconds
            const ts1 = new Date(baseTs.getTime());
            ts1.setMilliseconds(0);
            
            const ts2 = new Date(baseTs.getTime());
            ts2.setMilliseconds(500);
            
            const ts3 = new Date(baseTs.getTime());
            ts3.setMilliseconds(999);

            const quotes = [
              { symbolId: testSymbolId, ts: ts1, source, ...data },
              { symbolId: testSymbolId, ts: ts2, source, ...data },
              { symbolId: testSymbolId, ts: ts3, source, ...data },
            ];

            // Bulk upsert
            const upsertedCount = await quoteIntradayRepository.bulkUpsert(quotes);

            // Should report all upserts processed
            expect(upsertedCount).toBe(3);

            // Verify we have exactly 3 records (one per timestamp)
            const totalCount = await repository.count({
              where: { symbolId: testSymbolId, source },
            });
            expect(totalCount).toBe(3);

            // Verify each timestamp has exactly one record
            for (const quote of quotes) {
              const count = await repository.count({
                where: { symbolId: testSymbolId, ts: quote.ts, source },
              });
              expect(count).toBe(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
