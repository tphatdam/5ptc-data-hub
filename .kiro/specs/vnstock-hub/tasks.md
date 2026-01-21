# Implementation Plan: vnstock-hub

## Overview

This implementation plan breaks down the vnstock-hub NestJS application into discrete, incremental coding tasks. Each task builds upon previous work, with checkpoints to ensure stability. The plan follows a bottom-up approach: infrastructure → data layer → business logic → API layer → integration.

## Tasks

- [x] 1. Initialize NestJS project and configure TypeScript
  - Create new NestJS project using `nest new vnstock-hub` with npm
  - Configure strict TypeScript in tsconfig.json
  - Set up ESLint and Prettier configurations
  - Add all required dependencies to package.json: @nestjs/config, @nestjs/axios, @nestjs/typeorm, typeorm, pg, @nestjs/schedule, class-validator, class-transformer, pino, pino-pretty
  - Create directory structure: src/config, src/db, src/providers, src/ingestion, src/symbols, src/quotes, src/health
  - Verify project compiles with `npm run build`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ] 2. Set up configuration management with validation
  - [x] 2.1 Create configuration loader and validation schema
    - Implement src/config/configuration.ts to load environment variables
    - Implement src/config/validate-env.ts with class-validator decorators for all required and optional env vars
    - Configure ConfigModule in app.module.ts with validation
    - Create .env.example with all variables and sensible defaults
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 2.7_
  
  - [x] 2.2 Write property test for configuration validation
    - **Property 1: Missing required environment variables cause startup failure**
    - **Property 2: Optional environment variables allow startup**
    - **Validates: Requirements 2.4, 2.5**
  
  - [x] 2.3 Write unit tests for configuration edge cases
    - Test invalid PORT format
    - Test DATABASE_URL vs discrete DB_* variables
    - Test default values for optional variables
    - _Requirements: 2.3, 2.4_

- [ ] 3. Configure database connection and TypeORM
  - [x] 3.1 Set up TypeORM DataSource and module configuration
    - Create src/db/data-source.ts with DataSource configuration
    - Support both DATABASE_URL and discrete connection parameters
    - Configure TypeOrmModule in app.module.ts
    - Disable synchronize for production (NODE_ENV check)
    - Add npm scripts for migrations: migration:generate, migration:run, migration:revert
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [x] 3.2 Write property test for database configuration
    - **Property 3: Database connection configuration flexibility**
    - **Validates: Requirements 3.2**

- [ ] 4. Define database entities
  - [x] 4.1 Create Symbol entity
    - Implement src/db/entities/symbol.entity.ts with all fields
    - Add unique constraint on symbol field
    - Add timestamps (createdAt, updatedAt)
    - _Requirements: 4.1_
  
  - [x] 4.2 Create QuoteDaily entity
    - Implement src/db/entities/quote-daily.entity.ts with all fields
    - Add unique constraint on (symbolId, date, source)
    - Add index on (symbolId, date)
    - Add foreign key relationship to Symbol
    - _Requirements: 4.2, 4.3, 4.4_
  
  - [x] 4.3 Create QuoteIntraday entity
    - Implement src/db/entities/quote-intraday.entity.ts with all fields
    - Add unique constraint on (symbolId, ts, source)
    - Add index on (symbolId, ts)
    - Add foreign key relationship to Symbol
    - _Requirements: 4.5, 4.6, 4.7_
  
  - [x] 4.4 Create CrawlRun entity
    - Implement src/db/entities/crawl-run.entity.ts with all fields
    - Define CrawlRunStatus enum (RUNNING, SUCCESS, FAILED)
    - Use jsonb type for statsJson field
    - _Requirements: 4.8_
  
  - [x] 4.5 Generate and verify initial migrations
    - Generate migrations for all entities using TypeORM CLI
    - Review generated SQL for correctness
    - Test migration:run and migration:revert
    - _Requirements: 4.9_

- [x] 5. Checkpoint - Database setup verification
  - Ensure migrations run successfully
  - Verify all tables, constraints, and indexes are created
  - Test connection with both DATABASE_URL and discrete variables
  - Ask the user if questions arise

- [ ] 6. Implement repository services
  - [x] 6.1 Create SymbolsRepository
    - Implement src/symbols/symbols.repository.ts
    - Add upsertSymbol method using TypeORM save (handles conflicts)
    - Add findBySymbol method
    - Add searchSymbols method with ILIKE and pagination
    - Add getAllActive method
    - _Requirements: 5.1_
  
  - [x] 6.2 Write property test for symbol upsert
    - **Property 6: Symbol upsert idempotence**
    - **Validates: Requirements 5.1**
  
  - [x] 6.3 Create QuoteDailyRepository
    - Implement src/quotes/quote-daily.repository.ts
    - Add bulkUpsert method using raw SQL with INSERT ... ON CONFLICT DO UPDATE
    - Implement chunking logic for batches of 500 rows
    - Add findBySymbolAndDateRange method
    - _Requirements: 5.2, 5.5_
  
  - [x] 6.4 Write property tests for daily quotes repository
    - **Property 7: Daily quotes unique constraint enforcement**
    - **Property 10: Bulk upsert chunking**
    - **Validates: Requirements 4.3, 5.2, 5.5**
  
  - [x] 6.5 Create QuoteIntradayRepository
    - Implement src/quotes/quote-intraday.repository.ts
    - Add bulkUpsert method using raw SQL with INSERT ... ON CONFLICT DO UPDATE
    - Implement chunking logic for batches of 500 rows
    - Add findBySymbolAndTimeRange method
    - _Requirements: 5.3, 5.5_
  
  - [x] 6.6 Write property tests for intraday quotes repository
    - **Property 8: Intraday quotes unique constraint enforcement**
    - **Validates: Requirements 4.6, 5.3**
  
  - [x] 6.7 Create CrawlRunsRepository
    - Implement src/ingestion/crawl-runs.repository.ts
    - Add createRun method
    - Add markSuccess method (updates status, endedAt, statsJson)
    - Add markFailed method (updates status, endedAt, errorText, partial stats)
    - Add getRecentRuns method
    - _Requirements: 5.4_
  
  - [x] 6.8 Write property test for crawl run state transitions
    - **Property 9: Crawl run state transitions**
    - **Validates: Requirements 5.4, 8.5, 8.6, 8.7**

- [ ] 7. Implement HTTP client service with retry logic
  - [x] 7.1 Create HttpClientService
    - Implement src/providers/http-client.service.ts
    - Wrap @nestjs/axios HttpService
    - Apply timeout from HTTP_TIMEOUT_MS config
    - Implement retry logic with exponential backoff
    - Add retry conditions: network errors, 5xx, 429
    - Respect Retry-After header on 429 responses
    - Add random User-Agent header from predefined list
    - Sanitize and log request failures (remove sensitive headers)
    - Expose get and post methods returning parsed JSON
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  
  - [x] 7.2 Write property tests for HTTP client
    - **Property 11: Request timeout enforcement**
    - **Property 12: Retry with exponential backoff**
    - **Property 13: Retry-After header respect**
    - **Property 14: User-Agent header presence**
    - **Property 15: Sensitive header exclusion from logs**
    - **Property 16: JSON response parsing**
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8**
  
  - [x] 7.3 Write unit tests for HTTP client edge cases
    - Test network timeout scenarios
    - Test 429 with and without Retry-After header
    - Test non-retryable errors (4xx except 429)
    - Test max retries exhaustion
    - _Requirements: 6.3, 6.4, 6.5_

- [ ] 8. Implement provider abstraction layer
  - [x] 8.1 Define MarketProvider interface and DTOs
    - Create src/providers/market-provider.interface.ts
    - Define MarketProvider interface with name, fetchSymbols, fetchQuoteHistory, fetchIntraday methods
    - Create src/providers/dtos.ts with SymbolDTO, DailyBarDTO, IntradayTickDTO
    - Add class-validator decorators to DTOs
    - _Requirements: 7.1, 7.5, 7.6, 7.7_
  
  - [x] 8.2 Implement VciProvider skeleton
    - Create src/providers/vci/vci.provider.ts implementing MarketProvider
    - Create src/providers/vci/vci.constants.ts with placeholder URLs
    - Implement all methods returning empty arrays with TODO comments
    - Add proper error handling structure (try-catch with logging)
    - Implement placeholder mapping functions
    - _Requirements: 7.2, 7.3, 7.4, 7.8_
  
  - [x] 8.3 Write property test for DTO validation
    - **Property 17: Provider DTO mapping validity**
    - **Validates: Requirements 7.4**

- [~] 9. Checkpoint - Core services verification
  - Ensure all repositories work with test data
  - Verify HTTP client retry logic with mock server
  - Test provider skeleton returns empty arrays
  - Ask the user if questions arise

- [ ] 10. Implement ingestion service and scheduling
  - [x] 10.1 Create IngestionService with scheduled jobs
    - Implement src/ingestion/ingestion.service.ts
    - Add @Cron decorators for runIntraday15m ('*/15 * * * *') and runDailyEOD ('5 18 * * *' with Asia/Ho_Chi_Minh timezone)
    - Implement executeIngestionJob helper method
    - Handle crawl_run creation, status updates, and error handling
    - Implement symbol loading with auto-seeding if empty
    - Implement provider data fetching loop
    - Implement bulk upsert calls
    - Calculate and store statistics (symbolsCount, rowsUpserted, durationMs)
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.6, 8.7, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
  
  - [-] 10.2 Configure ScheduleModule in app.module.ts
    - Import and configure @nestjs/schedule ScheduleModule
    - Make cron schedules configurable via environment variables
    - _Requirements: 8.1, 8.4_
  
  - [~] 10.3 Write property tests for ingestion service
    - **Property 18: Configurable cron schedules**
    - **Property 19: Job execution creates running record**
    - **Property 20: Successful job completion updates record**
    - **Property 21: Failed job completion updates record**
    - **Property 22: Empty symbols table triggers seeding**
    - **Property 23: Provider called for each symbol**
    - **Property 24: Quote data persistence**
    - **Validates: Requirements 8.4, 8.5, 8.6, 8.7, 9.2, 9.3, 9.4**
  
  - [~] 10.4 Write unit tests for ingestion error scenarios
    - Test provider timeout during job
    - Test database error during bulk upsert
    - Test partial success scenarios
    - _Requirements: 8.7, 9.7_

- [ ] 11. Implement symbol seeding service
  - [~] 11.1 Create SymbolsSeederService
    - Implement src/symbols/symbols-seeder.service.ts
    - Add seedFromCSV method that reads CSV and upserts symbols
    - Parse CSV with proper error handling for malformed rows
    - Log processed count and error count
    - _Requirements: 10.2, 10.4, 10.5_
  
  - [~] 11.2 Create CLI command for seeding
    - Create src/cli/seed-symbols.ts
    - Bootstrap NestJS application context
    - Call SymbolsSeederService with /assets/all_symbols.csv path
    - Add npm script: seed:symbols
    - _Requirements: 10.3_
  
  - [~] 11.3 Create sample CSV file
    - Create /assets/all_symbols.csv with sample Vietnamese stock symbols
    - Include columns: symbol, exchange, name, industryCode, status
    - Add at least 10 sample symbols for testing
    - _Requirements: 10.1_
  
  - [~] 11.4 Write property test for CSV seeding
    - **Property 25: CSV parsing and upsert completeness**
    - **Validates: Requirements 10.2, 10.4, 10.5**

- [ ] 12. Implement Symbols API
  - [~] 12.1 Create SymbolsModule, Service, and Controller
    - Create src/symbols/symbols.module.ts
    - Implement src/symbols/symbols.service.ts wrapping SymbolsRepository
    - Implement src/symbols/symbols.controller.ts
    - Add GET /symbols endpoint with search, page, limit query params
    - Add GET /symbols/:symbol endpoint
    - Return 404 for non-existent symbols
    - Add proper validation using class-validator DTOs
    - _Requirements: 11.1, 11.2, 11.4, 11.5, 11.6_
  
  - [~] 12.2 Write property tests for Symbols API
    - **Property 26: Symbols endpoint pagination**
    - **Property 27: Symbol search case-insensitivity**
    - **Property 28: Symbol detail retrieval**
    - **Property 29: Symbol not found returns 404**
    - **Property 30: JSON content-type headers**
    - **Validates: Requirements 11.1, 11.2, 11.4, 11.5, 11.6**
  
  - [~] 12.3 Write unit tests for Symbols API edge cases
    - Test empty search results
    - Test pagination boundaries
    - Test invalid page/limit values
    - _Requirements: 11.1, 11.2_

- [ ] 13. Implement Quotes API
  - [~] 13.1 Create QuotesModule, Service, and Controller
    - Create src/quotes/quotes.module.ts
    - Implement src/quotes/quotes.service.ts wrapping quote repositories
    - Implement src/quotes/quotes.controller.ts
    - Create DTOs: GetDailyQuotesDto, GetIntradayQuotesDto with validation
    - Add GET /quotes/daily endpoint with symbol, start, end params
    - Add GET /quotes/intraday endpoint with symbol, start, end, limit params
    - Resolve symbol code to symbolId using SymbolsService
    - Enforce date range and result limits
    - Return normalized JSON arrays
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.7_
  
  - [~] 13.2 Write property tests for Quotes API
    - **Property 31: Daily quotes retrieval**
    - **Property 32: Intraday quotes retrieval**
    - **Property 33: Query parameter validation**
    - **Property 34: Date range and result limits enforcement**
    - **Property 35: Symbol code resolution**
    - **Property 36: Quotes response structure**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.7**
  
  - [~] 13.3 Write unit tests for Quotes API edge cases
    - Test symbol not found scenario
    - Test empty date range results
    - Test limit enforcement (max 5000)
    - Test default date ranges when not provided
    - _Requirements: 12.1, 12.2, 12.4_

- [ ] 14. Implement Health Check endpoints
  - [~] 14.1 Create HealthModule, Service, and Controller
    - Create src/health/health.module.ts
    - Implement src/health/health.service.ts with checkDatabase method
    - Implement src/health/health.controller.ts
    - Add GET /health endpoint (always returns 200 with version)
    - Add GET /health/db endpoint (checks database with simple query)
    - Return 503 when database is unavailable
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  
  - [~] 14.2 Write property tests for health endpoints
    - **Property 37: Health endpoint always available**
    - **Property 38: Database health check when connected**
    - **Property 39: Database health check when disconnected**
    - **Validates: Requirements 13.1, 13.2, 13.4, 13.5**
  
  - [~] 14.3 Write integration test for health with DB down
    - Test /health returns 200 when DB is down
    - Test /health/db returns 503 when DB is down
    - Test other endpoints fail when DB is down
    - **Property 4: Health endpoint availability without database**
    - **Property 5: Database-dependent endpoints fail gracefully**
    - **Validates: Requirements 3.6, 3.7**

- [ ] 15. Configure structured logging with Pino
  - [~] 15.1 Set up Pino logger globally
    - Configure Pino in main.ts with request ID tracking
    - Use JSON format when NODE_ENV=production
    - Use pino-pretty when NODE_ENV=development
    - Respect LOG_LEVEL environment variable
    - Add logger to all services (inject via NestJS)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.7_
  
  - [~] 15.2 Add logging to ingestion jobs
    - Log job start with job name and source
    - Log job end with statistics
    - Log errors with context
    - _Requirements: 14.5_
  
  - [~] 15.3 Write property tests for logging
    - **Property 40: Request ID tracking**
    - **Property 41: Production JSON logging**
    - **Property 42: Development pretty logging**
    - **Property 43: Ingestion job logging**
    - **Property 44: Log level filtering**
    - **Validates: Requirements 14.2, 14.3, 14.4, 14.5, 14.7**

- [~] 16. Checkpoint - API and logging verification
  - Test all API endpoints with curl or Postman
  - Verify logging output in both dev and prod modes
  - Test health checks with database up and down
  - Verify ingestion jobs create crawl_runs records
  - Ask the user if questions arise

- [ ] 17. Create Docker Compose setup for local development
  - [~] 17.1 Create docker-compose.yml
    - Define PostgreSQL service with exposed port (5432)
    - Use named volume for data persistence
    - Set environment variables for database credentials
    - _Requirements: 15.1, 15.2, 15.3_
  
  - [~] 17.2 Update .env.example for Docker setup
    - Add DATABASE_URL pointing to Docker PostgreSQL
    - Add all other required variables with defaults
    - _Requirements: 2.6_

- [ ] 18. Create comprehensive README documentation
  - [~] 18.1 Write setup instructions
    - Document step-by-step setup: copy .env.example, start Docker Compose, install deps, run migrations, seed symbols, start dev server
    - Add troubleshooting section
    - _Requirements: 15.4, 15.5_
  
  - [~] 18.2 Add API usage examples
    - Include curl examples for GET /symbols
    - Include curl examples for GET /symbols/:symbol
    - Include curl examples for GET /quotes/daily
    - Include curl examples for GET /quotes/intraday
    - Include curl examples for GET /health and GET /health/db
    - _Requirements: 15.6_
  
  - [~] 18.3 Document architecture and design decisions
    - Add overview of module structure
    - Document provider abstraction pattern
    - Document ingestion job scheduling
    - Link to design.md for detailed information

- [ ] 19. Final integration testing and verification
  - [~] 19.1 Write integration tests for complete flows
    - Test end-to-end: seed symbols → run ingestion job → query quotes API
    - Test error scenarios: provider timeout, database down, invalid data
    - **Property 45: Empty provider graceful handling**
    - **Validates: Requirements 15.7**
  
  - [~] 19.2 Manual verification checklist
    - Verify application starts with valid .env
    - Verify application fails fast with missing required env vars
    - Verify all API endpoints work as documented
    - Verify ingestion jobs execute on schedule
    - Verify logs are properly formatted
    - Verify Docker Compose setup works
    - Verify README instructions are accurate

- [~] 20. Final checkpoint - Production readiness
  - All tests passing (unit, property, integration)
  - All API endpoints documented and working
  - Docker Compose setup verified
  - README complete and accurate
  - Code linted and formatted
  - Migrations tested (run and revert)
  - Ask the user if questions arise

## Notes

- All tasks are required for complete implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end flows
- The implementation follows a bottom-up approach: infrastructure → data → logic → API
- Provider implementation is intentionally skeletal with TODOs for future enhancement
- All database operations use proper error handling and logging
