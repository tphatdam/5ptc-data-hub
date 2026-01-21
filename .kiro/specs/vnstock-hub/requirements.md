# Requirements Document

## Introduction

vnstock-hub is a NestJS-based data ingestion and API service for Vietnamese stock market data. The system provides scheduled data collection from market data providers, persistent storage in PostgreSQL, and RESTful APIs for querying historical and real-time stock quotes. The application is designed for reliability, observability, and extensibility to support multiple data providers.

## Glossary

- **System**: The vnstock-hub NestJS application
- **Provider**: External market data source (e.g., VCI) that supplies stock quotes and symbol information
- **Symbol**: A stock ticker code representing a tradable security on a Vietnamese exchange
- **Quote_Daily**: End-of-day OHLCV (Open, High, Low, Close, Volume) data for a symbol
- **Quote_Intraday**: Intraday tick data containing timestamp, price, and volume
- **Crawl_Run**: A record of a scheduled ingestion job execution with status and statistics
- **Ingestion_Job**: A scheduled task that fetches data from providers and stores it in the database
- **Bulk_Upsert**: An efficient database operation that inserts or updates multiple records in a single transaction
- **SymbolsRepo**: Repository service for managing symbol entities
- **QuoteDailyRepo**: Repository service for managing daily quote entities
- **QuoteIntradayRepo**: Repository service for managing intraday quote entities
- **CrawlRunsRepo**: Repository service for managing crawl run entities
- **HttpClientService**: Shared HTTP client with retry logic and timeout handling
- **MarketProvider**: Interface defining methods for fetching market data from external sources
- **IngestionService**: Service that orchestrates scheduled data collection jobs
- **SymbolsSeederService**: Service that imports symbol data from CSV files

## Requirements

### Requirement 1: Project Initialization and Structure

**User Story:** As a developer, I want a properly structured NestJS TypeScript project with all necessary dependencies, so that I can build upon a solid foundation.

#### Acceptance Criteria

1. THE System SHALL be initialized as a NestJS project using TypeScript and npm as the package manager
2. THE System SHALL include the following dependencies: @nestjs/config, @nestjs/axios, @nestjs/typeorm, typeorm, pg, @nestjs/schedule, class-validator, class-transformer, pino, pino-pretty
3. THE System SHALL organize source code in the following directory structure: src/app.module.ts, src/main.ts, src/config, src/db, src/providers, src/ingestion, src/symbols, src/quotes, src/health
4. THE System SHALL enforce strict TypeScript compilation settings
5. THE System SHALL include ESLint and Prettier configurations for code quality
6. THE System SHALL provide npm scripts for: start, start:dev, build, and TypeORM migration operations
7. THE System SHALL successfully compile and start without errors after initial setup

### Requirement 2: Configuration Management

**User Story:** As a system administrator, I want environment-based configuration with validation, so that the application fails fast with clear errors when misconfigured.

#### Acceptance Criteria

1. THE System SHALL use @nestjs/config ConfigModule for environment variable management
2. THE System SHALL validate all environment variables at startup using class-validator or joi
3. THE System SHALL require the following environment variables: NODE_ENV, PORT, DATABASE_URL (or DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME), LOG_LEVEL
4. THE System SHALL support optional environment variables: HTTP_TIMEOUT_MS, HTTP_RETRIES, HTTP_RETRY_BASE_MS
5. WHEN required environment variables are missing, THE System SHALL fail to start and display readable error messages indicating which variables are missing
6. THE System SHALL provide a .env.example file with default values for local development with PostgreSQL
7. THE System SHALL implement configuration loading in src/config/configuration.ts and validation in src/config/validate-env.ts

### Requirement 3: Database Integration

**User Story:** As a developer, I want TypeORM integration with PostgreSQL and migration support, so that I can manage database schema changes reliably.

#### Acceptance Criteria

1. THE System SHALL integrate TypeORM with PostgreSQL using TypeOrmModule
2. WHEN DATABASE_URL is provided, THE System SHALL use it for database connection; otherwise THE System SHALL use discrete environment variables (DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME)
3. THE System SHALL enable TypeORM migrations and disable synchronize in production environments
4. THE System SHALL provide a DataSource configuration in src/db/data-source.ts for migration CLI operations
5. THE System SHALL provide npm scripts for: migration:generate, migration:run, migration:revert
6. WHEN the database is unavailable, THE System SHALL allow startup for the /health endpoint only
7. WHEN the database is unavailable and database-dependent modules are accessed, THE System SHALL throw appropriate errors

### Requirement 4: Database Schema - Entities

**User Story:** As a data engineer, I want well-defined database entities with proper relationships and indexes, so that data is stored efficiently and can be queried performantly.

#### Acceptance Criteria

1. THE System SHALL define a symbols entity with: id (uuid PK), symbol (varchar unique), exchange, name, industryCode, status, createdAt, updatedAt
2. THE System SHALL define a quote_daily entity with: id (uuid PK), symbolId (FK to symbols), date (date), open (double), high (double), low (double), close (double), volume (bigint as string), source (text), ingestedAt (timestamp)
3. THE quote_daily entity SHALL enforce a unique constraint on (symbolId, date, source)
4. THE quote_daily entity SHALL have an index on (symbolId, date)
5. THE System SHALL define a quote_intraday entity with: id (uuid PK), symbolId (FK to symbols), ts (timestamptz), price (double), volume (bigint as string), source (text), ingestedAt (timestamp)
6. THE quote_intraday entity SHALL enforce a unique constraint on (symbolId, ts, source)
7. THE quote_intraday entity SHALL have an index on (symbolId, ts)
8. THE System SHALL define a crawl_runs entity with: id (uuid PK), jobName, source, startedAt, endedAt, status (enum: SUCCESS/FAILED/RUNNING), errorText, statsJson (jsonb)
9. THE System SHALL generate TypeORM migrations for all entities, constraints, and indexes

### Requirement 5: Repository Services

**User Story:** As a developer, I want repository services that provide efficient data access patterns, so that I can perform bulk operations and upserts reliably.

#### Acceptance Criteria

1. THE SymbolsRepo SHALL provide a method to upsert a symbol by symbol code
2. THE QuoteDailyRepo SHALL provide a bulk upsert method that handles conflicts on (symbolId, date, source) using INSERT ... ON CONFLICT DO UPDATE
3. THE QuoteIntradayRepo SHALL provide a bulk upsert method that handles conflicts on (symbolId, ts, source) using INSERT ... ON CONFLICT DO UPDATE
4. THE CrawlRunsRepo SHALL provide methods to: create a new run, mark a run as success, mark a run as failed, and store statsJson
5. WHEN performing bulk upserts with more than 500 rows, THE System SHALL chunk the operations into batches of 500 rows
6. THE System SHALL include tests or scripts to verify that upsert operations work correctly

### Requirement 6: HTTP Client Service

**User Story:** As a developer, I want a shared HTTP client with retry logic and timeout handling, so that external API calls are resilient to transient failures.

#### Acceptance Criteria

1. THE HttpClientService SHALL wrap the @nestjs/axios HttpModule
2. THE HttpClientService SHALL apply timeout values from the HTTP_TIMEOUT_MS environment variable
3. THE HttpClientService SHALL implement retry logic with exponential backoff using HTTP_RETRIES and HTTP_RETRY_BASE_MS environment variables
4. THE HttpClientService SHALL retry on network errors, HTTP 5xx status codes, and HTTP 429 (rate limit) status codes
5. WHEN a 429 response includes a Retry-After header, THE HttpClientService SHALL respect the specified delay before retrying
6. THE HttpClientService SHALL add a random User-Agent header from a predefined list to each request
7. THE HttpClientService SHALL log request failures without exposing sensitive headers
8. THE HttpClientService SHALL expose get and post methods that return parsed JSON responses

### Requirement 7: Market Data Provider Abstraction

**User Story:** As a developer, I want a provider abstraction layer, so that I can support multiple market data sources with a consistent interface.

#### Acceptance Criteria

1. THE System SHALL define a MarketProvider interface with methods: name (property), fetchSymbols(), fetchQuoteHistory(params), fetchIntraday(params)
2. THE System SHALL implement a VciProvider skeleton in src/providers/vci
3. THE VciProvider SHALL define constants for API endpoints in a const.ts file
4. THE VciProvider SHALL implement mapping functions to normalize external data to internal DTOs: SymbolDTO, DailyBarDTO, IntradayTickDTO
5. THE SymbolDTO SHALL contain: symbol, exchange (optional), name (optional)
6. THE DailyBarDTO SHALL contain: date, open, high, low, close, volume
7. THE IntradayTickDTO SHALL contain: ts (timestamp), price, volume
8. WHEN provider methods are not yet implemented, THE System SHALL return empty arrays with TODO markers and proper error handling structure

### Requirement 8: Data Ingestion Scheduling

**User Story:** As a system operator, I want automated scheduled jobs to fetch and store market data, so that the database stays up-to-date without manual intervention.

#### Acceptance Criteria

1. THE System SHALL use @nestjs/schedule ScheduleModule for job scheduling
2. THE IngestionService SHALL implement a runIntraday15m() method scheduled with @Cron('*/15 * * * *')
3. THE IngestionService SHALL implement a runDailyEOD() method scheduled with @Cron('5 18 * * *') in Vietnam timezone
4. THE System SHALL make the cron schedule configurable via environment variables or configuration
5. WHEN an ingestion job starts, THE System SHALL create a crawl_runs record with status RUNNING
6. WHEN an ingestion job completes successfully, THE System SHALL update the crawl_runs record with status SUCCESS and statsJson containing: symbolsCount, rowsUpserted, durationMs
7. WHEN an ingestion job fails, THE System SHALL update the crawl_runs record with status FAILED, errorText, and partial stats if available

### Requirement 9: Ingestion Job Execution Flow

**User Story:** As a data engineer, I want ingestion jobs to follow a reliable execution pattern, so that data is consistently fetched, validated, and stored.

#### Acceptance Criteria

1. WHEN an ingestion job executes, THE System SHALL load the list of symbols from the database
2. IF the symbols table is empty, THE System SHALL fetch symbols from the provider and seed the database
3. WHEN symbols are loaded, THE System SHALL call the provider to fetch quote data for each symbol
4. WHEN quote data is received, THE System SHALL perform bulk upsert into quote_intraday or quote_daily tables
5. WHEN the bulk upsert completes, THE System SHALL calculate statistics: symbolsCount, rowsUpserted, durationMs
6. WHEN all operations complete successfully, THE System SHALL mark the crawl_run as SUCCESS with statistics
7. IF any operation fails, THE System SHALL mark the crawl_run as FAILED with errorText and partial statistics

### Requirement 10: Symbol Data Seeding

**User Story:** As a system administrator, I want to seed the symbols table from a CSV file, so that I can initialize the database with a known list of tradable securities.

#### Acceptance Criteria

1. THE System SHALL provide a CSV file at /assets/all_symbols.csv containing symbol data
2. THE System SHALL implement a SymbolsSeederService that reads the CSV file and upserts symbols into the database
3. THE System SHALL provide an npm script: seed:symbols that executes the seeding operation
4. WHEN the seed:symbols command runs, THE System SHALL parse the CSV and upsert all symbols using the SymbolsRepo
5. THE System SHALL log the number of symbols processed and any errors encountered during seeding

### Requirement 11: Symbols API

**User Story:** As an API consumer, I want to query available symbols with search and detail endpoints, so that I can discover and retrieve symbol information.

#### Acceptance Criteria

1. THE System SHALL provide a GET /symbols endpoint that returns a paginated list of symbols
2. THE GET /symbols endpoint SHALL support a search query parameter that filters symbols using case-insensitive pattern matching
3. WHEN the search parameter is provided, THE System SHALL use ILIKE queries with appropriate indexes
4. THE System SHALL provide a GET /symbols/:symbol endpoint that returns detailed information for a specific symbol
5. WHEN a symbol is not found, THE GET /symbols/:symbol endpoint SHALL return an appropriate HTTP 404 status code
6. THE symbols endpoints SHALL return JSON responses with proper content-type headers

### Requirement 12: Quotes API

**User Story:** As an API consumer, I want to query historical and intraday quote data with filtering and pagination, so that I can retrieve market data for analysis.

#### Acceptance Criteria

1. THE System SHALL provide a GET /quotes/daily endpoint with query parameters: symbol (required), start (YYYY-MM-DD), end (YYYY-MM-DD)
2. THE System SHALL provide a GET /quotes/intraday endpoint with query parameters: symbol (required), start (ISO timestamp), end (ISO timestamp), limit (default: 2000)
3. THE quotes endpoints SHALL validate all query parameters using class-validator
4. THE quotes endpoints SHALL enforce sane limits on date ranges and result counts
5. WHEN a symbol parameter is provided, THE System SHALL resolve the symbol code to symbolId using SymbolsRepo
6. WHEN symbolId is resolved, THE System SHALL query quote_daily or quote_intraday tables using TypeORM with proper ordering and indexes
7. THE quotes endpoints SHALL return normalized JSON arrays with OHLCV data or tick data
8. THE quotes endpoints SHALL optionally include caching headers in responses

### Requirement 13: Health Check Endpoints

**User Story:** As a system operator, I want health check endpoints to monitor application and database status, so that I can detect issues quickly.

#### Acceptance Criteria

1. THE System SHALL provide a GET /health endpoint that always returns HTTP 200 OK
2. THE GET /health endpoint SHALL include the application version in the response
3. THE System SHALL provide a GET /health/db endpoint that checks database connectivity
4. WHEN the database is reachable, THE GET /health/db endpoint SHALL execute a simple query and return HTTP 200 OK
5. WHEN the database is unreachable, THE GET /health/db endpoint SHALL return an appropriate error status code

### Requirement 14: Structured Logging

**User Story:** As a system operator, I want structured JSON logging with request tracing, so that I can debug issues and monitor application behavior.

#### Acceptance Criteria

1. THE System SHALL use Pino as the logging library
2. THE System SHALL configure Pino globally with request ID tracking
3. WHEN NODE_ENV is production, THE System SHALL output structured JSON logs
4. WHEN NODE_ENV is development, THE System SHALL output pretty-formatted logs using pino-pretty
5. THE System SHALL log ingestion job start and end events with key statistics
6. THE System SHALL log HTTP request failures with relevant context (excluding sensitive headers)
7. THE System SHALL respect the LOG_LEVEL environment variable for log filtering

### Requirement 15: Local Development Environment

**User Story:** As a developer, I want a Docker Compose setup for local PostgreSQL, so that I can develop and test without external dependencies.

#### Acceptance Criteria

1. THE System SHALL provide a docker-compose.yml file that defines a PostgreSQL service
2. THE PostgreSQL service SHALL expose a port for local connections
3. THE PostgreSQL service SHALL use a named volume for data persistence
4. THE System SHALL provide a README with step-by-step setup instructions
5. THE README SHALL document the following steps: copy .env.example to .env, start Docker Compose, install dependencies, run migrations, seed symbols, start development server
6. THE README SHALL include example curl commands for /symbols and /quotes endpoints
7. WHEN the application starts with an empty provider implementation, THE System SHALL boot successfully and endpoints SHALL work (returning empty data arrays while still recording crawl_runs)
