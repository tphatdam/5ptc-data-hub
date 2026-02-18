import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { SymbolsRepository } from '../../src/modules/symbols/symbols.repository';
import { Symbol } from '../../src/db/entities/symbol.entity';
import { QuoteDaily } from '../../src/db/entities/quote-daily.entity';
import { QuoteIntraday } from '../../src/db/entities/quote-intraday.entity';

// Load environment variables
config();

describe('SymbolsRepository - Property Tests', () => {
  let module: TestingModule;
  let symbolsRepository: SymbolsRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Create test database connection with PostgreSQL
    // Use the default 'postgres' database which should always exist
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
        TypeOrmModule.forFeature([Symbol]),
      ],
      providers: [SymbolsRepository],
    }).compile();

    symbolsRepository = module.get<SymbolsRepository>(SymbolsRepository);
    dataSource = module.get<DataSource>(DataSource);
  }, 30000); // Increase timeout for database connection

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
    if (module) {
      await module.close();
    }
  });

  beforeEach(async () => {
    // Clear the symbols table before each test
    // Use query builder to delete all records
    const repository = dataSource.getRepository(Symbol);
    await repository.createQueryBuilder().delete().execute();
  });

  describe('Property 6: Symbol upsert idempotence', () => {
    /**
     * **Validates: Requirements 5.1**
     *
     * For any symbol data, calling upsert twice with the same symbol code should
     * result in exactly one record in the database with the latest data.
     */
    it('should maintain exactly one record after multiple upserts with the same symbol code', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a symbol code
          fc.string({ minLength: 1, maxLength: 20 }),
          // Generate first set of symbol data
          fc.record({
            exchange: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
            name: fc.option(fc.string({ maxLength: 255 }), { nil: undefined }),
            industryCode: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
            status: fc.option(fc.constantFrom('ACTIVE', 'INACTIVE', 'DELISTED'), { nil: undefined }),
          }),
          // Generate second set of symbol data (potentially different)
          fc.record({
            exchange: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
            name: fc.option(fc.string({ maxLength: 255 }), { nil: undefined }),
            industryCode: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
            status: fc.option(fc.constantFrom('ACTIVE', 'INACTIVE', 'DELISTED'), { nil: undefined }),
          }),
          async (symbolCode, firstData, secondData) => {
            // First upsert
            const firstUpsert = await symbolsRepository.upsertSymbol({
              symbol: symbolCode,
              ...firstData,
            });

            // Verify first upsert created exactly one record
            const repository = dataSource.getRepository(Symbol);
            const countAfterFirst = await repository.count({
              where: { symbol: symbolCode },
            });
            expect(countAfterFirst).toBe(1);
            expect(firstUpsert.symbol).toBe(symbolCode);

            // Second upsert with potentially different data
            const secondUpsert = await symbolsRepository.upsertSymbol({
              symbol: symbolCode,
              ...secondData,
            });

            // Verify still exactly one record exists
            const countAfterSecond = await repository.count({
              where: { symbol: symbolCode },
            });
            expect(countAfterSecond).toBe(1);

            // Verify the record has the latest data
            const finalRecord = await repository.findOne({
              where: { symbol: symbolCode },
            });

            expect(finalRecord).toBeDefined();
            expect(finalRecord!.symbol).toBe(symbolCode);
            expect(finalRecord!.id).toBe(firstUpsert.id); // Same ID (updated, not created new)
            expect(finalRecord!.id).toBe(secondUpsert.id); // Same ID as second upsert

            // Verify the data matches the second upsert (latest data)
            if (secondData.exchange !== null && secondData.exchange !== undefined) {
              expect(finalRecord!.exchange).toBe(secondData.exchange);
            }
            if (secondData.name !== null && secondData.name !== undefined) {
              expect(finalRecord!.name).toBe(secondData.name);
            }
            if (secondData.industryCode !== null && secondData.industryCode !== undefined) {
              expect(finalRecord!.industryCode).toBe(secondData.industryCode);
            }
            if (secondData.status !== null && secondData.status !== undefined) {
              expect(finalRecord!.status).toBe(secondData.status);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple consecutive upserts with the same symbol code', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a symbol code
          fc.string({ minLength: 1, maxLength: 20 }),
          // Generate an array of symbol data updates (2-5 updates)
          fc.array(
            fc.record({
              exchange: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
              name: fc.option(fc.string({ maxLength: 255 }), { nil: undefined }),
              industryCode: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
              status: fc.option(fc.constantFrom('ACTIVE', 'INACTIVE', 'DELISTED'), { nil: undefined }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (symbolCode, dataUpdates) => {
            const repository = dataSource.getRepository(Symbol);
            let lastUpsertId: string | undefined;

            // Perform multiple upserts
            for (const data of dataUpdates) {
              const result = await symbolsRepository.upsertSymbol({
                symbol: symbolCode,
                ...data,
              });

              // Track the ID from first upsert
              if (!lastUpsertId) {
                lastUpsertId = result.id;
              }

              // Verify the ID remains the same (update, not insert)
              expect(result.id).toBe(lastUpsertId);

              // Verify still exactly one record
              const count = await repository.count({
                where: { symbol: symbolCode },
              });
              expect(count).toBe(1);
            }

            // Final verification: exactly one record with the last update's data
            const finalCount = await repository.count({
              where: { symbol: symbolCode },
            });
            expect(finalCount).toBe(1);

            const finalRecord = await repository.findOne({
              where: { symbol: symbolCode },
            });
            expect(finalRecord).toBeDefined();
            expect(finalRecord!.id).toBe(lastUpsertId);

            // Verify the data matches the last update
            const lastUpdate = dataUpdates[dataUpdates.length - 1];
            if (lastUpdate.exchange !== null && lastUpdate.exchange !== undefined) {
              expect(finalRecord!.exchange).toBe(lastUpdate.exchange);
            }
            if (lastUpdate.name !== null && lastUpdate.name !== undefined) {
              expect(finalRecord!.name).toBe(lastUpdate.name);
            }
            if (lastUpdate.industryCode !== null && lastUpdate.industryCode !== undefined) {
              expect(finalRecord!.industryCode).toBe(lastUpdate.industryCode);
            }
            if (lastUpdate.status !== null && lastUpdate.status !== undefined) {
              expect(finalRecord!.status).toBe(lastUpdate.status);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve existing fields when upserting with partial data', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a symbol code
          fc.string({ minLength: 1, maxLength: 20 }),
          // Generate complete initial data
          fc.record({
            exchange: fc.string({ minLength: 1, maxLength: 50 }),
            name: fc.string({ minLength: 1, maxLength: 255 }),
            industryCode: fc.string({ minLength: 1, maxLength: 50 }),
            status: fc.constantFrom('ACTIVE', 'INACTIVE', 'DELISTED'),
          }),
          // Generate partial update (only some fields)
          fc.constantFrom(
            { name: 'Updated Name' },
            { exchange: 'UPDATED_EXCHANGE' },
            { industryCode: 'UPDATED_CODE' },
            { status: 'INACTIVE' },
            {} // Empty update
          ),
          async (symbolCode, initialData, partialUpdate) => {
            const repository = dataSource.getRepository(Symbol);

            // First upsert with complete data
            await symbolsRepository.upsertSymbol({
              symbol: symbolCode,
              ...initialData,
            });

            // Second upsert with partial data
            await symbolsRepository.upsertSymbol({
              symbol: symbolCode,
              ...partialUpdate,
            });

            // Verify still exactly one record
            const count = await repository.count({
              where: { symbol: symbolCode },
            });
            expect(count).toBe(1);

            // Verify the record has updated fields from partial update
            // and preserved fields from initial data
            const finalRecord = await repository.findOne({
              where: { symbol: symbolCode },
            });

            expect(finalRecord).toBeDefined();
            expect(finalRecord!.symbol).toBe(symbolCode);

            // Check updated fields
            if ('name' in partialUpdate && partialUpdate.name) {
              expect(finalRecord!.name).toBe(partialUpdate.name);
            } else {
              expect(finalRecord!.name).toBe(initialData.name);
            }

            if ('exchange' in partialUpdate && partialUpdate.exchange) {
              expect(finalRecord!.exchange).toBe(partialUpdate.exchange);
            } else {
              expect(finalRecord!.exchange).toBe(initialData.exchange);
            }

            if ('industryCode' in partialUpdate && partialUpdate.industryCode) {
              expect(finalRecord!.industryCode).toBe(partialUpdate.industryCode);
            } else {
              expect(finalRecord!.industryCode).toBe(initialData.industryCode);
            }

            if ('status' in partialUpdate && partialUpdate.status) {
              expect(finalRecord!.status).toBe(partialUpdate.status);
            } else {
              expect(finalRecord!.status).toBe(initialData.status);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle concurrent upserts of different symbols without conflicts', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple unique symbol codes
          fc.uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), {
            minLength: 2,
            maxLength: 10,
          }),
          // Generate data for each symbol
          fc.array(
            fc.record({
              exchange: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
              name: fc.option(fc.string({ maxLength: 255 }), { nil: undefined }),
              industryCode: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
              status: fc.option(fc.constantFrom('ACTIVE', 'INACTIVE', 'DELISTED'), { nil: undefined }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (symbolCodes, dataArray) => {
            const repository = dataSource.getRepository(Symbol);

            // Clean up before this test iteration
            await repository.createQueryBuilder().delete().execute();

            // Ensure we have matching data for each symbol
            const symbolDataPairs = symbolCodes.map((code, idx) => ({
              code,
              data: dataArray[idx % dataArray.length],
            }));

            // Upsert all symbols
            const upsertPromises = symbolDataPairs.map(({ code, data }) =>
              symbolsRepository.upsertSymbol({
                symbol: code,
                ...data,
              })
            );

            await Promise.all(upsertPromises);

            // Verify each symbol has exactly one record
            for (const { code } of symbolDataPairs) {
              const count = await repository.count({
                where: { symbol: code },
              });
              expect(count).toBe(1);
            }

            // Verify total count matches number of unique symbols
            const totalCount = await repository.count();
            expect(totalCount).toBe(symbolCodes.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
