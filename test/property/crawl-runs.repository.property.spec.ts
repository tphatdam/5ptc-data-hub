import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { CrawlRunsRepository } from '../../src/modules/ingestion/crawl-runs.repository';
import { CrawlRun, CrawlRunStatus } from '../../src/db/entities/crawl-run.entity';
import { Symbol } from '../../src/db/entities/symbol.entity';
import { QuoteDaily } from '../../src/db/entities/quote-daily.entity';
import { QuoteIntraday } from '../../src/db/entities/quote-intraday.entity';

// Load environment variables
config();

describe('CrawlRunsRepository - Property Tests', () => {
  let module: TestingModule;
  let crawlRunsRepository: CrawlRunsRepository;
  let dataSource: DataSource;

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
          entities: [Symbol, QuoteDaily, QuoteIntraday, CrawlRun],
          synchronize: true, // OK for tests
          dropSchema: false, // Don't drop schema - we'll clean up manually
          logging: false,
        }),
        TypeOrmModule.forFeature([CrawlRun]),
      ],
      providers: [CrawlRunsRepository],
    }).compile();

    crawlRunsRepository = module.get<CrawlRunsRepository>(CrawlRunsRepository);
    dataSource = module.get<DataSource>(DataSource);
  }, 30000); // Increase timeout for database connection

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      // Clean up crawl_runs records
      const crawlRunRepository = dataSource.getRepository(CrawlRun);
      await crawlRunRepository.createQueryBuilder().delete().where('1=1').execute();
      
      await dataSource.destroy();
    }
    if (module) {
      await module.close();
    }
  });

  beforeEach(async () => {
    // Clear the crawl_runs table before each test
    const repository = dataSource.getRepository(CrawlRun);
    await repository.createQueryBuilder().delete().where('1=1').execute();
  });

  describe('Property 9: Crawl run state transitions', () => {
    /**
     * **Validates: Requirements 5.4, 8.5, 8.6, 8.7**
     *
     * For any crawl run, the state should transition from RUNNING to either SUCCESS
     * (with stats) or FAILED (with error text), never remaining in RUNNING indefinitely.
     */
    it('should transition from RUNNING to SUCCESS with stats', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate job name
          fc.constantFrom('intraday-15m', 'daily-eod', 'weekly-summary', 'monthly-report'),
          // Generate source
          fc.constantFrom('VCI', 'SSI', 'TCBS', 'VNDIRECT'),
          // Generate stats
          fc.record({
            symbolsCount: fc.integer({ min: 0, max: 1000 }),
            rowsUpserted: fc.integer({ min: 0, max: 100000 }),
            durationMs: fc.integer({ min: 100, max: 600000 }),
          }),
          async (jobName, source, stats) => {
            const repository = dataSource.getRepository(CrawlRun);

            // Create a crawl run (should start with RUNNING status)
            const crawlRun = await crawlRunsRepository.createRun({
              jobName,
              source,
            });

            // Verify initial state is RUNNING
            expect(crawlRun.status).toBe(CrawlRunStatus.RUNNING);
            expect(crawlRun.startedAt).toBeInstanceOf(Date);
            expect(crawlRun.endedAt).toBeNull();
            expect(crawlRun.errorText).toBeNull();
            expect(crawlRun.statsJson).toBeNull();

            // Mark as success
            await crawlRunsRepository.markSuccess(crawlRun.id, stats);

            // Verify state transitioned to SUCCESS
            const updatedRun = await repository.findOne({
              where: { id: crawlRun.id },
            });

            expect(updatedRun).toBeDefined();
            expect(updatedRun!.status).toBe(CrawlRunStatus.SUCCESS);
            expect(updatedRun!.endedAt).toBeInstanceOf(Date);
            expect(updatedRun!.endedAt).not.toBeNull();
            expect(updatedRun!.statsJson).toEqual(stats);
            expect(updatedRun!.errorText).toBeNull();

            // Verify endedAt is after startedAt
            expect(updatedRun!.endedAt!.getTime()).toBeGreaterThanOrEqual(
              updatedRun!.startedAt.getTime()
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should transition from RUNNING to FAILED with error text', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate job name
          fc.constantFrom('intraday-15m', 'daily-eod', 'weekly-summary', 'monthly-report'),
          // Generate source
          fc.constantFrom('VCI', 'SSI', 'TCBS', 'VNDIRECT'),
          // Generate error text
          fc.oneof(
            fc.constant('Provider timeout'),
            fc.constant('Database connection lost'),
            fc.constant('Network error'),
            fc.constant('Invalid response format'),
            fc.constant('Rate limit exceeded'),
            fc.string({ minLength: 1, maxLength: 200 })
          ),
          async (jobName, source, errorText) => {
            const repository = dataSource.getRepository(CrawlRun);

            // Create a crawl run (should start with RUNNING status)
            const crawlRun = await crawlRunsRepository.createRun({
              jobName,
              source,
            });

            // Verify initial state is RUNNING
            expect(crawlRun.status).toBe(CrawlRunStatus.RUNNING);
            expect(crawlRun.startedAt).toBeInstanceOf(Date);
            expect(crawlRun.endedAt).toBeNull();
            expect(crawlRun.errorText).toBeNull();
            expect(crawlRun.statsJson).toBeNull();

            // Mark as failed
            await crawlRunsRepository.markFailed(crawlRun.id, errorText);

            // Verify state transitioned to FAILED
            const updatedRun = await repository.findOne({
              where: { id: crawlRun.id },
            });

            expect(updatedRun).toBeDefined();
            expect(updatedRun!.status).toBe(CrawlRunStatus.FAILED);
            expect(updatedRun!.endedAt).toBeInstanceOf(Date);
            expect(updatedRun!.endedAt).not.toBeNull();
            expect(updatedRun!.errorText).toBe(errorText);

            // Verify endedAt is after startedAt
            expect(updatedRun!.endedAt!.getTime()).toBeGreaterThanOrEqual(
              updatedRun!.startedAt.getTime()
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should transition from RUNNING to FAILED with partial stats', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate job name
          fc.constantFrom('intraday-15m', 'daily-eod', 'weekly-summary', 'monthly-report'),
          // Generate source
          fc.constantFrom('VCI', 'SSI', 'TCBS', 'VNDIRECT'),
          // Generate error text
          fc.oneof(
            fc.constant('Provider timeout'),
            fc.constant('Database connection lost'),
            fc.constant('Network error')
          ),
          // Generate partial stats (may not have all fields)
          fc.record({
            symbolsCount: fc.option(fc.integer({ min: 0, max: 1000 })),
            rowsUpserted: fc.option(fc.integer({ min: 0, max: 100000 })),
            durationMs: fc.option(fc.integer({ min: 100, max: 600000 })),
          }),
          async (jobName, source, errorText, partialStats) => {
            const repository = dataSource.getRepository(CrawlRun);

            // Create a crawl run (should start with RUNNING status)
            const crawlRun = await crawlRunsRepository.createRun({
              jobName,
              source,
            });

            // Verify initial state is RUNNING
            expect(crawlRun.status).toBe(CrawlRunStatus.RUNNING);

            // Mark as failed with partial stats
            await crawlRunsRepository.markFailed(crawlRun.id, errorText, partialStats);

            // Verify state transitioned to FAILED
            const updatedRun = await repository.findOne({
              where: { id: crawlRun.id },
            });

            expect(updatedRun).toBeDefined();
            expect(updatedRun!.status).toBe(CrawlRunStatus.FAILED);
            expect(updatedRun!.endedAt).toBeInstanceOf(Date);
            expect(updatedRun!.endedAt).not.toBeNull();
            expect(updatedRun!.errorText).toBe(errorText);
            expect(updatedRun!.statsJson).toEqual(partialStats);

            // Verify endedAt is after startedAt
            expect(updatedRun!.endedAt!.getTime()).toBeGreaterThanOrEqual(
              updatedRun!.startedAt.getTime()
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never leave a crawl run in RUNNING state after completion', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate job name
          fc.constantFrom('intraday-15m', 'daily-eod', 'weekly-summary', 'monthly-report'),
          // Generate source
          fc.constantFrom('VCI', 'SSI', 'TCBS', 'VNDIRECT'),
          // Generate completion type (success or failure)
          fc.boolean(),
          // Generate stats for success case
          fc.record({
            symbolsCount: fc.integer({ min: 0, max: 1000 }),
            rowsUpserted: fc.integer({ min: 0, max: 100000 }),
            durationMs: fc.integer({ min: 100, max: 600000 }),
          }),
          // Generate error text for failure case
          fc.string({ minLength: 1, maxLength: 200 }),
          async (jobName, source, isSuccess, stats, errorText) => {
            const repository = dataSource.getRepository(CrawlRun);

            // Create a crawl run
            const crawlRun = await crawlRunsRepository.createRun({
              jobName,
              source,
            });

            // Verify initial state is RUNNING
            expect(crawlRun.status).toBe(CrawlRunStatus.RUNNING);

            // Complete the run (either success or failure)
            if (isSuccess) {
              await crawlRunsRepository.markSuccess(crawlRun.id, stats);
            } else {
              await crawlRunsRepository.markFailed(crawlRun.id, errorText);
            }

            // Verify the run is no longer in RUNNING state
            const updatedRun = await repository.findOne({
              where: { id: crawlRun.id },
            });

            expect(updatedRun).toBeDefined();
            expect(updatedRun!.status).not.toBe(CrawlRunStatus.RUNNING);
            expect(updatedRun!.endedAt).not.toBeNull();
            expect(updatedRun!.endedAt).toBeInstanceOf(Date);

            // Verify the status is either SUCCESS or FAILED
            expect([CrawlRunStatus.SUCCESS, CrawlRunStatus.FAILED]).toContain(
              updatedRun!.status
            );

            // Verify appropriate fields are set based on status
            if (updatedRun!.status === CrawlRunStatus.SUCCESS) {
              expect(updatedRun!.statsJson).toEqual(stats);
              expect(updatedRun!.errorText).toBeNull();
            } else {
              expect(updatedRun!.errorText).toBe(errorText);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure endedAt is always set when transitioning from RUNNING', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate job name
          fc.constantFrom('intraday-15m', 'daily-eod', 'weekly-summary', 'monthly-report'),
          // Generate source
          fc.constantFrom('VCI', 'SSI', 'TCBS', 'VNDIRECT'),
          // Generate completion type (success or failure)
          fc.boolean(),
          async (jobName, source, isSuccess) => {
            const repository = dataSource.getRepository(CrawlRun);

            // Create a crawl run
            const crawlRun = await crawlRunsRepository.createRun({
              jobName,
              source,
            });

            // Record the start time
            const startTime = crawlRun.startedAt.getTime();

            // Wait a small amount of time to ensure endedAt will be different
            await new Promise(resolve => setTimeout(resolve, 10));

            // Complete the run
            if (isSuccess) {
              await crawlRunsRepository.markSuccess(crawlRun.id, {
                symbolsCount: 10,
                rowsUpserted: 100,
                durationMs: 1000,
              });
            } else {
              await crawlRunsRepository.markFailed(crawlRun.id, 'Test error');
            }

            // Verify endedAt is set and is after startedAt
            const updatedRun = await repository.findOne({
              where: { id: crawlRun.id },
            });

            expect(updatedRun).toBeDefined();
            expect(updatedRun!.endedAt).not.toBeNull();
            expect(updatedRun!.endedAt).toBeInstanceOf(Date);
            expect(updatedRun!.endedAt!.getTime()).toBeGreaterThanOrEqual(startTime);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain data integrity across multiple state transitions', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate an array of crawl run operations
          fc.array(
            fc.record({
              jobName: fc.constantFrom('intraday-15m', 'daily-eod', 'weekly-summary'),
              source: fc.constantFrom('VCI', 'SSI', 'TCBS'),
              isSuccess: fc.boolean(),
              stats: fc.record({
                symbolsCount: fc.integer({ min: 0, max: 1000 }),
                rowsUpserted: fc.integer({ min: 0, max: 100000 }),
                durationMs: fc.integer({ min: 100, max: 600000 }),
              }),
              errorText: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (operations) => {
            const repository = dataSource.getRepository(CrawlRun);

            // Execute all operations
            for (const op of operations) {
              // Create run
              const crawlRun = await crawlRunsRepository.createRun({
                jobName: op.jobName,
                source: op.source,
              });

              // Verify RUNNING state
              expect(crawlRun.status).toBe(CrawlRunStatus.RUNNING);

              // Complete the run
              if (op.isSuccess) {
                await crawlRunsRepository.markSuccess(crawlRun.id, op.stats);
              } else {
                await crawlRunsRepository.markFailed(crawlRun.id, op.errorText);
              }

              // Verify final state
              const finalRun = await repository.findOne({
                where: { id: crawlRun.id },
              });

              expect(finalRun).toBeDefined();
              expect(finalRun!.status).not.toBe(CrawlRunStatus.RUNNING);
              expect(finalRun!.endedAt).not.toBeNull();
            }

            // Verify all runs are in terminal state (SUCCESS or FAILED)
            const allRuns = await repository.find();
            for (const run of allRuns) {
              expect(run.status).not.toBe(CrawlRunStatus.RUNNING);
              expect(run.endedAt).not.toBeNull();
              expect([CrawlRunStatus.SUCCESS, CrawlRunStatus.FAILED]).toContain(run.status);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle concurrent state transitions correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple concurrent operations
          fc.array(
            fc.record({
              jobName: fc.constantFrom('intraday-15m', 'daily-eod'),
              source: fc.constantFrom('VCI', 'SSI'),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (operations) => {
            const repository = dataSource.getRepository(CrawlRun);

            // Create all runs concurrently
            const crawlRuns = await Promise.all(
              operations.map(op => crawlRunsRepository.createRun(op))
            );

            // Verify all are in RUNNING state
            for (const run of crawlRuns) {
              expect(run.status).toBe(CrawlRunStatus.RUNNING);
            }

            // Complete all runs concurrently (alternating success/failure)
            await Promise.all(
              crawlRuns.map((run, index) => {
                if (index % 2 === 0) {
                  return crawlRunsRepository.markSuccess(run.id, {
                    symbolsCount: 10,
                    rowsUpserted: 100,
                    durationMs: 1000,
                  });
                } else {
                  return crawlRunsRepository.markFailed(run.id, 'Test error');
                }
              })
            );

            // Verify all runs are in terminal state
            for (const run of crawlRuns) {
              const finalRun = await repository.findOne({
                where: { id: run.id },
              });

              expect(finalRun).toBeDefined();
              expect(finalRun!.status).not.toBe(CrawlRunStatus.RUNNING);
              expect(finalRun!.endedAt).not.toBeNull();
              expect([CrawlRunStatus.SUCCESS, CrawlRunStatus.FAILED]).toContain(
                finalRun!.status
              );
            }
          }
        ),
        { numRuns: 50 } // Reduced runs for concurrent operations
      );
    });
  });
});
