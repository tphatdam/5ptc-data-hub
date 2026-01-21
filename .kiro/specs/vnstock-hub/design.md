# Design Document: vnstock-hub

## Overview

vnstock-hub is a NestJS-based market data ingestion and API service for Vietnamese stock market data. The system follows a modular architecture with clear separation between data ingestion, storage, and API layers. The design emphasizes reliability through retry mechanisms, observability through structured logging, and extensibility through provider abstractions.

### Key Design Principles

1. **Modularity**: Each functional area (symbols, quotes, ingestion, health) is encapsulated in its own NestJS module
2. **Provider Abstraction**: Market data sources are abstracted behind a common interface to support multiple providers
3. **Idempotent Operations**: Bulk upserts use database constraints to ensure data consistency across retries
4. **Fail-Fast Configuration**: Environment validation at startup prevents runtime configuration errors
5. **Observability**: Structured logging and crawl run tracking provide visibility into system behavior

### Technology Stack

- **Runtime**: Node.js with TypeScript (strict mode)
- **Framework**: NestJS (modular architecture, dependency injection)
- **Database**: PostgreSQL with TypeORM (migrations, repositories)
- **HTTP Client**: Axios with retry logic and timeout handling
- **Scheduling**: @nestjs/schedule with cron expressions
- **Logging**: Pino (structured JSON in production, pretty in development)
- **Validation**: class-validator and class-transformer

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      NestJS Application                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Symbols    │  │    Quotes    │  │    Health    │     │
│  │  Controller  │  │  Controller  │  │  Controller  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐     │
│  │   Symbols    │  │    Quotes    │  │    Health    │     │
│  │   Service    │  │   Service    │  │   Service    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘     │
│         │                  │                                 │
│         └──────────┬───────┘                                │
│                    │                                         │
│         ┌──────────▼───────────┐                           │
│         │  Repository Services  │                           │
│         │  (Symbols, Quotes,    │                           │
│         │   CrawlRuns Repos)    │                           │
│         └──────────┬────────────┘                           │
│                    │                                         │
│         ┌──────────▼────────────┐                           │
│         │   TypeORM Entities    │                           │
│         └──────────┬────────────┘                           │
│                    │                                         │
│                    ▼                                         │
│         ┌─────────────────────┐                             │
│         │   PostgreSQL DB     │                             │
│         └─────────────────────┘                             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Ingestion Module (Scheduled Jobs)          │  │
│  │  ┌────────────────┐         ┌──────────────────┐    │  │
│  │  │  Intraday Job  │         │   Daily EOD Job  │    │  │
│  │  │  (Every 15min) │         │   (Daily 18:05)  │    │  │
│  │  └────────┬───────┘         └────────┬─────────┘    │  │
│  │           │                           │               │  │
│  │           └───────────┬───────────────┘               │  │
│  │                       │                               │  │
│  │            ┌──────────▼──────────┐                    │  │
│  │            │ IngestionService    │                    │  │
│  │            └──────────┬──────────┘                    │  │
│  │                       │                               │  │
│  │            ┌──────────▼──────────┐                    │  │
│  │            │  Market Providers   │                    │  │
│  │            │  (VciProvider, etc) │                    │  │
│  │            └──────────┬──────────┘                    │  │
│  │                       │                               │  │
│  │            ┌──────────▼──────────┐                    │  │
│  │            │  HttpClientService  │                    │  │
│  │            │  (Retry + Timeout)  │                    │  │
│  │            └─────────────────────┘                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  External Provider   │
                │  APIs (VCI, etc)     │
                └──────────────────────┘
```

### Module Organization


**AppModule** (src/app.module.ts)
- Root module that imports all feature modules
- Configures global modules: ConfigModule, TypeOrmModule, ScheduleModule, LoggerModule

**ConfigModule** (src/config/)
- Loads and validates environment variables
- Provides typed configuration objects to other modules
- Files: configuration.ts (loader), validate-env.ts (validation schema)

**DatabaseModule** (src/db/)
- TypeORM configuration and DataSource
- Migration management
- Files: data-source.ts (TypeORM DataSource for CLI)

**SymbolsModule** (src/symbols/)
- Manages symbol entities and API endpoints
- Components: SymbolsController, SymbolsService, SymbolsRepository
- Endpoints: GET /symbols, GET /symbols/:symbol

**QuotesModule** (src/quotes/)
- Manages quote entities and API endpoints
- Components: QuotesController, QuotesService, QuoteDailyRepository, QuoteIntradayRepository
- Endpoints: GET /quotes/daily, GET /quotes/intraday

**IngestionModule** (src/ingestion/)
- Scheduled data collection jobs
- Components: IngestionService, CrawlRunsRepository
- Jobs: runIntraday15m (every 15 minutes), runDailyEOD (daily at 18:05)

**ProvidersModule** (src/providers/)
- Market data provider abstraction and implementations
- Components: MarketProvider interface, VciProvider, HttpClientService
- Supports multiple provider implementations

**HealthModule** (src/health/)
- Health check endpoints
- Components: HealthController, HealthService
- Endpoints: GET /health, GET /health/db

## Components and Interfaces

### Configuration Layer

#### ConfigurationService

Provides typed access to validated environment variables.

```typescript
interface AppConfig {
  nodeEnv: string;
  port: number;
  logLevel: string;
}

interface DatabaseConfig {
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
}

interface HttpConfig {
  timeoutMs: number;
  retries: number;
  retryBaseMs: number;
}
```


#### Environment Validation

Uses class-validator to validate environment variables at startup:

```typescript
class EnvironmentVariables {
  @IsEnum(['development', 'production', 'test'])
  NODE_ENV: string;

  @IsPort()
  PORT: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  DATABASE_URL?: string;

  @ValidateIf(o => !o.DATABASE_URL)
  @IsString()
  DB_HOST?: string;

  // ... additional validations
}
```

Validation occurs in main.ts before application bootstrap. If validation fails, the application exits with a descriptive error message listing missing or invalid variables.

### Database Layer

#### Entity Definitions

**Symbol Entity** (src/db/entities/symbol.entity.ts)

```typescript
@Entity('symbols')
@Index(['symbol'], { unique: true })
class Symbol {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  symbol: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  exchange: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  industryCode: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => QuoteDaily, quote => quote.symbol)
  dailyQuotes: QuoteDaily[];

  @OneToMany(() => QuoteIntraday, quote => quote.symbol)
  intradayQuotes: QuoteIntraday[];
}
```

**QuoteDaily Entity** (src/db/entities/quote-daily.entity.ts)

```typescript
@Entity('quote_daily')
@Index(['symbolId', 'date'])
@Unique(['symbolId', 'date', 'source'])
class QuoteDaily {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  symbolId: string;

  @ManyToOne(() => Symbol, symbol => symbol.dailyQuotes)
  @JoinColumn({ name: 'symbolId' })
  symbol: Symbol;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'double precision' })
  open: number;

  @Column({ type: 'double precision' })
  high: number;

  @Column({ type: 'double precision' })
  low: number;

  @Column({ type: 'double precision' })
  close: number;

  @Column({ type: 'varchar', length: 50 })
  volume: string; // bigint as string

  @Column({ type: 'varchar', length: 50 })
  source: string;

  @CreateDateColumn()
  ingestedAt: Date;
}
```


**QuoteIntraday Entity** (src/db/entities/quote-intraday.entity.ts)

```typescript
@Entity('quote_intraday')
@Index(['symbolId', 'ts'])
@Unique(['symbolId', 'ts', 'source'])
class QuoteIntraday {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  symbolId: string;

  @ManyToOne(() => Symbol, symbol => symbol.intradayQuotes)
  @JoinColumn({ name: 'symbolId' })
  symbol: Symbol;

  @Column({ type: 'timestamptz' })
  ts: Date;

  @Column({ type: 'double precision' })
  price: number;

  @Column({ type: 'varchar', length: 50 })
  volume: string; // bigint as string

  @Column({ type: 'varchar', length: 50 })
  source: string;

  @CreateDateColumn()
  ingestedAt: Date;
}
```

**CrawlRun Entity** (src/db/entities/crawl-run.entity.ts)

```typescript
enum CrawlRunStatus {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED'
}

@Entity('crawl_runs')
class CrawlRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  jobName: string;

  @Column({ type: 'varchar', length: 50 })
  source: string;

  @Column({ type: 'timestamptz' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date;

  @Column({ type: 'enum', enum: CrawlRunStatus })
  status: CrawlRunStatus;

  @Column({ type: 'text', nullable: true })
  errorText: string;

  @Column({ type: 'jsonb', nullable: true })
  statsJson: Record<string, any>;
}
```

#### Repository Services

**SymbolsRepository** (src/symbols/symbols.repository.ts)

```typescript
interface SymbolsRepository {
  // Upsert symbol by symbol code
  upsertSymbol(data: {
    symbol: string;
    exchange?: string;
    name?: string;
    industryCode?: string;
    status?: string;
  }): Promise<Symbol>;

  // Find symbol by code
  findBySymbol(symbol: string): Promise<Symbol | null>;

  // Search symbols with pagination
  searchSymbols(search: string, page: number, limit: number): Promise<{
    data: Symbol[];
    total: number;
  }>;

  // Get all active symbols
  getAllActive(): Promise<Symbol[]>;
}
```

Implementation uses TypeORM's `save()` method which performs upsert based on unique constraints.


**QuoteDailyRepository** (src/quotes/quote-daily.repository.ts)

```typescript
interface QuoteDailyRepository {
  // Bulk upsert daily quotes
  bulkUpsert(quotes: Array<{
    symbolId: string;
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: string;
    source: string;
  }>): Promise<number>; // returns count of upserted rows

  // Query quotes by symbol and date range
  findBySymbolAndDateRange(
    symbolId: string,
    startDate: Date,
    endDate: Date
  ): Promise<QuoteDaily[]>;
}
```

Implementation uses raw SQL with `INSERT ... ON CONFLICT (symbolId, date, source) DO UPDATE` for efficient bulk upserts. Chunks operations into batches of 500 rows.

**QuoteIntradayRepository** (src/quotes/quote-intraday.repository.ts)

```typescript
interface QuoteIntradayRepository {
  // Bulk upsert intraday quotes
  bulkUpsert(quotes: Array<{
    symbolId: string;
    ts: Date;
    price: number;
    volume: string;
    source: string;
  }>): Promise<number>;

  // Query quotes by symbol and timestamp range
  findBySymbolAndTimeRange(
    symbolId: string,
    startTs: Date,
    endTs: Date,
    limit: number
  ): Promise<QuoteIntraday[]>;
}
```

Implementation uses raw SQL with `INSERT ... ON CONFLICT (symbolId, ts, source) DO UPDATE`. Chunks operations into batches of 500 rows.

**CrawlRunsRepository** (src/ingestion/crawl-runs.repository.ts)

```typescript
interface CrawlRunsRepository {
  // Create new crawl run
  createRun(data: {
    jobName: string;
    source: string;
  }): Promise<CrawlRun>;

  // Mark run as success
  markSuccess(id: string, stats: {
    symbolsCount: number;
    rowsUpserted: number;
    durationMs: number;
  }): Promise<void>;

  // Mark run as failed
  markFailed(id: string, errorText: string, partialStats?: any): Promise<void>;

  // Get recent runs
  getRecentRuns(jobName: string, limit: number): Promise<CrawlRun[]>;
}
```

### HTTP Client Layer

**HttpClientService** (src/providers/http-client.service.ts)

```typescript
interface HttpClientService {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
}
```

Implementation details:
- Wraps @nestjs/axios HttpService
- Applies timeout from HTTP_TIMEOUT_MS (default: 30000ms)
- Implements retry logic with exponential backoff
- Retry conditions: network errors, 5xx status codes, 429 rate limits
- Respects Retry-After header on 429 responses
- Adds random User-Agent from predefined list
- Logs failures with sanitized headers (removes Authorization, Cookie, etc.)


Retry logic pseudocode:

```typescript
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  baseDelayMs: number
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }
      
      let delayMs = baseDelayMs * Math.pow(2, attempt);
      
      if (error.response?.status === 429 && error.response?.headers['retry-after']) {
        const retryAfter = parseInt(error.response.headers['retry-after']);
        delayMs = retryAfter * 1000;
      }
      
      await sleep(delayMs);
    }
  }
}

function isRetryableError(error: any): boolean {
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return true;
  }
  if (error.response?.status >= 500 || error.response?.status === 429) {
    return true;
  }
  return false;
}
```

### Provider Abstraction Layer

**MarketProvider Interface** (src/providers/market-provider.interface.ts)

```typescript
interface MarketProvider {
  readonly name: string;

  fetchSymbols(): Promise<SymbolDTO[]>;

  fetchQuoteHistory(params: {
    symbol: string;
    startDate: Date;
    endDate: Date;
  }): Promise<DailyBarDTO[]>;

  fetchIntraday(params?: {
    symbol: string;
    startTime?: Date;
    endTime?: Date;
  }): Promise<IntradayTickDTO[]>;
}
```

**Data Transfer Objects**

```typescript
interface SymbolDTO {
  symbol: string;
  exchange?: string;
  name?: string;
  industryCode?: string;
}

interface DailyBarDTO {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: string;
}

interface IntradayTickDTO {
  ts: Date;
  price: number;
  volume: string;
}
```

**VciProvider Implementation** (src/providers/vci/vci.provider.ts)

```typescript
@Injectable()
class VciProvider implements MarketProvider {
  readonly name = 'VCI';

  constructor(private httpClient: HttpClientService) {}

  async fetchSymbols(): Promise<SymbolDTO[]> {
    // TODO: Implement VCI API call
    // For now, return empty array with proper error handling structure
    try {
      // const response = await this.httpClient.get(VCI_SYMBOLS_URL);
      // return this.mapSymbolsResponse(response);
      return [];
    } catch (error) {
      this.logger.error('Failed to fetch symbols from VCI', error);
      throw new Error('VCI symbols fetch failed');
    }
  }

  async fetchQuoteHistory(params: {
    symbol: string;
    startDate: Date;
    endDate: Date;
  }): Promise<DailyBarDTO[]> {
    // TODO: Implement VCI API call
    return [];
  }

  async fetchIntraday(params?: {
    symbol: string;
    startTime?: Date;
    endTime?: Date;
  }): Promise<IntradayTickDTO[]> {
    // TODO: Implement VCI API call
    return [];
  }

  private mapSymbolsResponse(response: any): SymbolDTO[] {
    // TODO: Map VCI response format to SymbolDTO
    return [];
  }
}
```


VCI constants file (src/providers/vci/vci.constants.ts):

```typescript
// Placeholder URLs - to be updated with actual VCI endpoints
export const VCI_BASE_URL = 'https://api.vci.com.vn'; // TODO: Update with actual URL
export const VCI_SYMBOLS_URL = `${VCI_BASE_URL}/symbols`; // TODO: Update
export const VCI_QUOTES_URL = `${VCI_BASE_URL}/quotes`; // TODO: Update
export const VCI_INTRADAY_URL = `${VCI_BASE_URL}/intraday`; // TODO: Update
```

### Ingestion Layer

**IngestionService** (src/ingestion/ingestion.service.ts)

```typescript
@Injectable()
class IngestionService {
  constructor(
    private symbolsRepo: SymbolsRepository,
    private quoteDailyRepo: QuoteDailyRepository,
    private quoteIntradayRepo: QuoteIntradayRepository,
    private crawlRunsRepo: CrawlRunsRepository,
    private provider: MarketProvider,
    private logger: Logger
  ) {}

  @Cron('*/15 * * * *') // Every 15 minutes
  async runIntraday15m(): Promise<void> {
    await this.executeIngestionJob('intraday-15m', async (symbols) => {
      const allTicks: IntradayTickDTO[] = [];
      
      for (const symbol of symbols) {
        const ticks = await this.provider.fetchIntraday({
          symbol: symbol.symbol
        });
        
        const ticksWithSymbolId = ticks.map(tick => ({
          ...tick,
          symbolId: symbol.id,
          source: this.provider.name
        }));
        
        allTicks.push(...ticksWithSymbolId);
      }
      
      const rowsUpserted = await this.quoteIntradayRepo.bulkUpsert(allTicks);
      return { rowsUpserted };
    });
  }

  @Cron('5 18 * * *', { timeZone: 'Asia/Ho_Chi_Minh' }) // Daily at 18:05 Vietnam time
  async runDailyEOD(): Promise<void> {
    await this.executeIngestionJob('daily-eod', async (symbols) => {
      const allBars: DailyBarDTO[] = [];
      const today = new Date();
      
      for (const symbol of symbols) {
        const bars = await this.provider.fetchQuoteHistory({
          symbol: symbol.symbol,
          startDate: today,
          endDate: today
        });
        
        const barsWithSymbolId = bars.map(bar => ({
          ...bar,
          symbolId: symbol.id,
          source: this.provider.name
        }));
        
        allBars.push(...barsWithSymbolId);
      }
      
      const rowsUpserted = await this.quoteDailyRepo.bulkUpsert(allBars);
      return { rowsUpserted };
    });
  }

  private async executeIngestionJob(
    jobName: string,
    fetchAndStore: (symbols: Symbol[]) => Promise<{ rowsUpserted: number }>
  ): Promise<void> {
    const startTime = Date.now();
    const crawlRun = await this.crawlRunsRepo.createRun({
      jobName,
      source: this.provider.name
    });

    try {
      // Load symbols
      let symbols = await this.symbolsRepo.getAllActive();
      
      // If no symbols, fetch and seed
      if (symbols.length === 0) {
        this.logger.warn('No symbols found, fetching from provider');
        const symbolDTOs = await this.provider.fetchSymbols();
        
        for (const dto of symbolDTOs) {
          await this.symbolsRepo.upsertSymbol(dto);
        }
        
        symbols = await this.symbolsRepo.getAllActive();
      }

      // Fetch and store data
      const { rowsUpserted } = await fetchAndStore(symbols);

      // Calculate stats
      const durationMs = Date.now() - startTime;
      const stats = {
        symbolsCount: symbols.length,
        rowsUpserted,
        durationMs
      };

      await this.crawlRunsRepo.markSuccess(crawlRun.id, stats);
      this.logger.info(`Job ${jobName} completed successfully`, stats);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorText = error.message || 'Unknown error';
      
      await this.crawlRunsRepo.markFailed(crawlRun.id, errorText, { durationMs });
      this.logger.error(`Job ${jobName} failed`, { error: errorText, durationMs });
    }
  }
}
```


### Seeding Layer

**SymbolsSeederService** (src/symbols/symbols-seeder.service.ts)

```typescript
@Injectable()
class SymbolsSeederService {
  constructor(
    private symbolsRepo: SymbolsRepository,
    private logger: Logger
  ) {}

  async seedFromCSV(filePath: string): Promise<void> {
    this.logger.info(`Starting symbol seeding from ${filePath}`);
    
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const lines = fileContent.split('\n');
    const headers = lines[0].split(',');
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      try {
        const values = lines[i].split(',');
        const symbolData = {
          symbol: values[0]?.trim(),
          exchange: values[1]?.trim(),
          name: values[2]?.trim(),
          industryCode: values[3]?.trim(),
          status: values[4]?.trim() || 'ACTIVE'
        };
        
        await this.symbolsRepo.upsertSymbol(symbolData);
        processedCount++;
      } catch (error) {
        this.logger.error(`Failed to process line ${i}`, error);
        errorCount++;
      }
    }
    
    this.logger.info(`Seeding complete: ${processedCount} processed, ${errorCount} errors`);
  }
}
```

CLI command implementation (src/cli/seed-symbols.ts):

```typescript
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const seeder = app.get(SymbolsSeederService);
  
  const csvPath = path.join(__dirname, '../../assets/all_symbols.csv');
  await seeder.seedFromCSV(csvPath);
  
  await app.close();
}

bootstrap();
```

### API Layer

**SymbolsController** (src/symbols/symbols.controller.ts)

```typescript
@Controller('symbols')
class SymbolsController {
  constructor(private symbolsService: SymbolsService) {}

  @Get()
  async searchSymbols(
    @Query('search') search?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50
  ): Promise<{
    data: Symbol[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.symbolsService.searchSymbols(search || '', page, limit);
  }

  @Get(':symbol')
  async getSymbol(@Param('symbol') symbol: string): Promise<Symbol> {
    const result = await this.symbolsService.findBySymbol(symbol);
    
    if (!result) {
      throw new NotFoundException(`Symbol ${symbol} not found`);
    }
    
    return result;
  }
}
```

**QuotesController** (src/quotes/quotes.controller.ts)

```typescript
class GetDailyQuotesDto {
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsDateString()
  @IsOptional()
  start?: string;

  @IsDateString()
  @IsOptional()
  end?: string;
}

class GetIntradayQuotesDto {
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsISO8601()
  @IsOptional()
  start?: string;

  @IsISO8601()
  @IsOptional()
  end?: string;

  @IsInt()
  @Min(1)
  @Max(5000)
  @IsOptional()
  limit?: number = 2000;
}

@Controller('quotes')
class QuotesController {
  constructor(
    private quotesService: QuotesService,
    private symbolsService: SymbolsService
  ) {}

  @Get('daily')
  async getDailyQuotes(@Query() query: GetDailyQuotesDto): Promise<QuoteDaily[]> {
    const symbol = await this.symbolsService.findBySymbol(query.symbol);
    
    if (!symbol) {
      throw new NotFoundException(`Symbol ${query.symbol} not found`);
    }
    
    const startDate = query.start ? new Date(query.start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = query.end ? new Date(query.end) : new Date();
    
    return this.quotesService.getDailyQuotes(symbol.id, startDate, endDate);
  }

  @Get('intraday')
  async getIntradayQuotes(@Query() query: GetIntradayQuotesDto): Promise<QuoteIntraday[]> {
    const symbol = await this.symbolsService.findBySymbol(query.symbol);
    
    if (!symbol) {
      throw new NotFoundException(`Symbol ${query.symbol} not found`);
    }
    
    const startTs = query.start ? new Date(query.start) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endTs = query.end ? new Date(query.end) : new Date();
    
    return this.quotesService.getIntradayQuotes(symbol.id, startTs, endTs, query.limit);
  }
}
```


**HealthController** (src/health/health.controller.ts)

```typescript
@Controller('health')
class HealthController {
  constructor(
    private healthService: HealthService,
    private configService: ConfigService
  ) {}

  @Get()
  getHealth(): { status: string; version: string } {
    return {
      status: 'ok',
      version: process.env.npm_package_version || '1.0.0'
    };
  }

  @Get('db')
  async getDbHealth(): Promise<{ status: string; database: string }> {
    const isHealthy = await this.healthService.checkDatabase();
    
    if (!isHealthy) {
      throw new ServiceUnavailableException('Database is not available');
    }
    
    return {
      status: 'ok',
      database: 'connected'
    };
  }
}
```

**HealthService** (src/health/health.service.ts)

```typescript
@Injectable()
class HealthService {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource
  ) {}

  async checkDatabase(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }
}
```

## Data Models

### Database Schema

**symbols table**
- id: uuid (PK)
- symbol: varchar(20) (unique)
- exchange: varchar(50)
- name: varchar(255)
- industryCode: varchar(50)
- status: varchar(20) (default: 'ACTIVE')
- createdAt: timestamp
- updatedAt: timestamp

**quote_daily table**
- id: uuid (PK)
- symbolId: uuid (FK → symbols.id)
- date: date
- open: double precision
- high: double precision
- low: double precision
- close: double precision
- volume: varchar(50) (stores bigint as string)
- source: varchar(50)
- ingestedAt: timestamp
- UNIQUE(symbolId, date, source)
- INDEX(symbolId, date)

**quote_intraday table**
- id: uuid (PK)
- symbolId: uuid (FK → symbols.id)
- ts: timestamptz
- price: double precision
- volume: varchar(50) (stores bigint as string)
- source: varchar(50)
- ingestedAt: timestamp
- UNIQUE(symbolId, ts, source)
- INDEX(symbolId, ts)

**crawl_runs table**
- id: uuid (PK)
- jobName: varchar(100)
- source: varchar(50)
- startedAt: timestamptz
- endedAt: timestamptz
- status: enum('RUNNING', 'SUCCESS', 'FAILED')
- errorText: text
- statsJson: jsonb

### Migration Strategy

Migrations are generated and managed using TypeORM CLI:

```bash
# Generate migration from entity changes
npm run migration:generate -- -n MigrationName

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

Initial migrations to create:
1. CreateSymbolsTable
2. CreateQuoteDailyTable
3. CreateQuoteIntradayTable
4. CreateCrawlRunsTable
5. AddIndexesToQuoteTables

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Configuration Properties

Property 1: Missing required environment variables cause startup failure
*For any* required environment variable (NODE_ENV, PORT, DATABASE_URL or DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME, LOG_LEVEL), when it is missing, the system should fail to start with an error message containing the variable name
**Validates: Requirements 2.5**

Property 2: Optional environment variables allow startup
*For any* optional environment variable (HTTP_TIMEOUT_MS, HTTP_RETRIES, HTTP_RETRY_BASE_MS), when it is missing, the system should start successfully with default values
**Validates: Requirements 2.4**

Property 3: Database connection configuration flexibility
*For any* valid database configuration (either DATABASE_URL or discrete DB_* variables), the system should successfully connect to the database
**Validates: Requirements 3.2**

Property 4: Health endpoint availability without database
*For any* system state where the database is unavailable, the /health endpoint should return HTTP 200 OK
**Validates: Requirements 3.6**

Property 5: Database-dependent endpoints fail gracefully
*For any* database-dependent endpoint (/symbols, /quotes/*), when the database is unavailable, the endpoint should throw an appropriate error
**Validates: Requirements 3.7**

### Repository Properties

Property 6: Symbol upsert idempotence
*For any* symbol data, calling upsert twice with the same symbol code should result in exactly one record in the database with the latest data
**Validates: Requirements 5.1**

Property 7: Daily quotes unique constraint enforcement
*For any* set of daily quotes with duplicate (symbolId, date, source) tuples, bulk upsert should result in one record per unique tuple with the latest data
**Validates: Requirements 4.3, 5.2**

Property 8: Intraday quotes unique constraint enforcement
*For any* set of intraday quotes with duplicate (symbolId, ts, source) tuples, bulk upsert should result in one record per unique tuple with the latest data
**Validates: Requirements 4.6, 5.3**

Property 9: Crawl run state transitions
*For any* crawl run, the state should transition from RUNNING to either SUCCESS (with stats) or FAILED (with error text), never remaining in RUNNING indefinitely
**Validates: Requirements 5.4, 8.5, 8.6, 8.7**

Property 10: Bulk upsert chunking
*For any* bulk upsert operation with N > 500 rows, the operation should be executed in chunks of at most 500 rows each
**Validates: Requirements 5.5**

### HTTP Client Properties

Property 11: Request timeout enforcement
*For any* HTTP request that takes longer than HTTP_TIMEOUT_MS milliseconds, the request should timeout and throw an error
**Validates: Requirements 6.2**

Property 12: Retry with exponential backoff
*For any* retryable HTTP error (network error, 5xx, 429), the client should retry up to HTTP_RETRIES times with exponentially increasing delays based on HTTP_RETRY_BASE_MS
**Validates: Requirements 6.3, 6.4**

Property 13: Retry-After header respect
*For any* HTTP 429 response with a Retry-After header, the next retry attempt should wait at least the specified number of seconds
**Validates: Requirements 6.5**

Property 14: User-Agent header presence
*For any* HTTP request, the request should include a User-Agent header with a value from the predefined list
**Validates: Requirements 6.6**

Property 15: Sensitive header exclusion from logs
*For any* failed HTTP request log entry, the log should not contain Authorization, Cookie, or other sensitive headers
**Validates: Requirements 6.7, 14.6**

Property 16: JSON response parsing
*For any* HTTP response with valid JSON content, the get and post methods should return the parsed JavaScript object
**Validates: Requirements 6.8**

### Provider Properties

Property 17: Provider DTO mapping validity
*For any* external data format from a provider, the mapping functions should produce DTOs that pass class-validator validation
**Validates: Requirements 7.4**

### Ingestion Properties

Property 18: Configurable cron schedules
*For any* valid cron expression in environment configuration, the ingestion jobs should use that schedule instead of hardcoded values
**Validates: Requirements 8.4**

Property 19: Job execution creates running record
*For any* ingestion job execution, a crawl_runs record with status RUNNING should be created before data fetching begins
**Validates: Requirements 8.5**

Property 20: Successful job completion updates record
*For any* ingestion job that completes without errors, the crawl_runs record should be updated to SUCCESS status with statsJson containing symbolsCount, rowsUpserted, and durationMs
**Validates: Requirements 8.6, 9.5, 9.6**

Property 21: Failed job completion updates record
*For any* ingestion job that throws an error, the crawl_runs record should be updated to FAILED status with errorText and partial stats if available
**Validates: Requirements 8.7, 9.7**

Property 22: Empty symbols table triggers seeding
*For any* ingestion job execution when the symbols table is empty, the job should fetch symbols from the provider and populate the symbols table before fetching quotes
**Validates: Requirements 9.2**

Property 23: Provider called for each symbol
*For any* list of N symbols loaded from the database, the ingestion job should call the provider's fetch method N times (once per symbol)
**Validates: Requirements 9.3**

Property 24: Quote data persistence
*For any* quote data received from a provider, the data should be stored in the appropriate quote table (daily or intraday) via bulk upsert
**Validates: Requirements 9.4**

### Seeding Properties

Property 25: CSV parsing and upsert completeness
*For any* valid CSV file with N rows of symbol data, the seeder should attempt to upsert all N symbols and log the count of processed and failed rows
**Validates: Requirements 10.2, 10.4, 10.5**

### API Properties

Property 26: Symbols endpoint pagination
*For any* request to GET /symbols with page and limit parameters, the response should contain a data array with at most limit items and pagination metadata
**Validates: Requirements 11.1**

Property 27: Symbol search case-insensitivity
*For any* search query string, the GET /symbols endpoint should return symbols matching the query regardless of case (e.g., "aaa" matches "AAA")
**Validates: Requirements 11.2**

Property 28: Symbol detail retrieval
*For any* valid symbol code, GET /symbols/:symbol should return the symbol's complete data
**Validates: Requirements 11.4**

Property 29: Symbol not found returns 404
*For any* non-existent symbol code, GET /symbols/:symbol should return HTTP 404 status
**Validates: Requirements 11.5**

Property 30: JSON content-type headers
*For any* response from symbols or quotes endpoints, the Content-Type header should be application/json
**Validates: Requirements 11.6**

Property 31: Daily quotes retrieval
*For any* valid symbol and date range, GET /quotes/daily should return an array of daily quotes within that range ordered by date
**Validates: Requirements 12.1**

Property 32: Intraday quotes retrieval
*For any* valid symbol and timestamp range, GET /quotes/intraday should return an array of intraday quotes within that range ordered by timestamp, limited to the specified limit
**Validates: Requirements 12.2**

Property 33: Query parameter validation
*For any* invalid query parameter (wrong type, format, or missing required field), the quotes endpoints should return a validation error response
**Validates: Requirements 12.3**

Property 34: Date range and result limits enforcement
*For any* query with excessive date range or result count, the quotes endpoints should either reject the request or enforce maximum limits
**Validates: Requirements 12.4**

Property 35: Symbol code resolution
*For any* symbol code provided in quotes API requests, the system should resolve it to the correct symbolId before querying quote tables
**Validates: Requirements 12.5**

Property 36: Quotes response structure
*For any* quotes API response, the data should be a JSON array where each element contains the appropriate fields (OHLCV for daily, price/volume/ts for intraday)
**Validates: Requirements 12.7**

### Health Check Properties

Property 37: Health endpoint always available
*For any* system state (including database down), GET /health should return HTTP 200 OK with status and version fields
**Validates: Requirements 13.1, 13.2**

Property 38: Database health check when connected
*For any* system state where the database is reachable, GET /health/db should execute a query and return HTTP 200 OK
**Validates: Requirements 13.4**

Property 39: Database health check when disconnected
*For any* system state where the database is unreachable, GET /health/db should return an error status code (5xx)
**Validates: Requirements 13.5**

### Logging Properties

Property 40: Request ID tracking
*For any* HTTP request processed by the system, all log entries related to that request should include the same request ID
**Validates: Requirements 14.2**

Property 41: Production JSON logging
*For any* log entry when NODE_ENV is production, the log output should be valid JSON
**Validates: Requirements 14.3**

Property 42: Development pretty logging
*For any* log entry when NODE_ENV is development, the log output should be human-readable formatted text (not JSON)
**Validates: Requirements 14.4**

Property 43: Ingestion job logging
*For any* ingestion job execution, there should be log entries for job start and job end with statistics
**Validates: Requirements 14.5**

Property 44: Log level filtering
*For any* LOG_LEVEL setting, only log entries at that level or higher severity should appear in the output
**Validates: Requirements 14.7**

### Integration Properties

Property 45: Empty provider graceful handling
*For any* system startup with provider methods returning empty arrays, the application should start successfully, API endpoints should work (returning empty results), and ingestion jobs should complete with zero rows upserted
**Validates: Requirements 15.7**


## Error Handling

### Error Categories

**Configuration Errors** (Fail-Fast)
- Missing required environment variables
- Invalid environment variable formats
- Database connection string parsing errors
- Action: Exit process with descriptive error message before application starts

**Database Errors** (Graceful Degradation)
- Connection failures during runtime
- Query timeouts
- Constraint violations
- Action: Log error, return appropriate HTTP status (503 for unavailable, 500 for internal errors), allow /health endpoint to remain functional

**Provider Errors** (Retry and Log)
- Network timeouts
- Rate limiting (429)
- Server errors (5xx)
- Invalid response formats
- Action: Retry with exponential backoff (up to configured limit), log failures, mark crawl_run as FAILED

**Validation Errors** (Client Error Response)
- Invalid query parameters
- Missing required fields
- Type mismatches
- Action: Return HTTP 400 with detailed validation error messages

**Not Found Errors** (Client Error Response)
- Symbol not found
- No data for date range
- Action: Return HTTP 404 with descriptive message

### Error Response Format

All API errors follow a consistent format:

```typescript
interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}
```

Example:

```json
{
  "statusCode": 404,
  "message": "Symbol AAA not found",
  "error": "Not Found",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/symbols/AAA"
}
```

### Error Logging Strategy

- Configuration errors: Log to stderr before exit
- Database errors: Log with ERROR level, include query context (sanitized)
- Provider errors: Log with WARN level for retryable errors, ERROR for final failures
- Validation errors: Log with DEBUG level (client errors, not system errors)
- Unexpected errors: Log with ERROR level, include stack trace

### Circuit Breaker Pattern (Future Enhancement)

For production resilience, consider implementing circuit breaker pattern for provider calls:
- Track failure rate over sliding window
- Open circuit after threshold failures
- Half-open state for recovery testing
- Prevents cascading failures and excessive retries

## Testing Strategy

### Dual Testing Approach

The testing strategy combines unit tests and property-based tests to achieve comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
- Focus on concrete scenarios and integration points
- Test error handling paths
- Verify specific business logic examples
- Test edge cases (empty arrays, null values, boundary conditions)

**Property-Based Tests**: Verify universal properties across all inputs
- Test properties that should hold for any valid input
- Use randomized input generation for comprehensive coverage
- Catch edge cases that might be missed in example-based tests
- Minimum 100 iterations per property test

Together, these approaches provide complementary coverage: unit tests catch concrete bugs and verify specific behaviors, while property tests verify general correctness across the input space.

### Property-Based Testing Configuration

**Library Selection**: Use `fast-check` for TypeScript property-based testing

**Test Configuration**:
- Minimum 100 iterations per property test (configured via `fc.assert` options)
- Each property test must reference its design document property
- Tag format: `// Feature: vnstock-hub, Property N: [property text]`

**Example Property Test**:

```typescript
import * as fc from 'fast-check';

describe('SymbolsRepository', () => {
  it('should maintain upsert idempotence', async () => {
    // Feature: vnstock-hub, Property 6: Symbol upsert idempotence
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          symbol: fc.string({ minLength: 1, maxLength: 20 }),
          exchange: fc.option(fc.string()),
          name: fc.option(fc.string())
        }),
        async (symbolData) => {
          // First upsert
          await symbolsRepo.upsertSymbol(symbolData);
          const firstCount = await symbolsRepo.count({ symbol: symbolData.symbol });
          
          // Second upsert
          await symbolsRepo.upsertSymbol(symbolData);
          const secondCount = await symbolsRepo.count({ symbol: symbolData.symbol });
          
          // Should have exactly one record
          expect(firstCount).toBe(1);
          expect(secondCount).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Test Organization

```
test/
├── unit/
│   ├── config/
│   │   └── validate-env.spec.ts
│   ├── repositories/
│   │   ├── symbols.repository.spec.ts
│   │   ├── quote-daily.repository.spec.ts
│   │   └── quote-intraday.repository.spec.ts
│   ├── providers/
│   │   ├── http-client.service.spec.ts
│   │   └── vci/
│   │       └── vci.provider.spec.ts
│   ├── ingestion/
│   │   └── ingestion.service.spec.ts
│   └── api/
│       ├── symbols.controller.spec.ts
│       ├── quotes.controller.spec.ts
│       └── health.controller.spec.ts
├── property/
│   ├── repositories.property.spec.ts
│   ├── http-client.property.spec.ts
│   ├── ingestion.property.spec.ts
│   └── api.property.spec.ts
└── integration/
    ├── database.integration.spec.ts
    ├── api-endpoints.integration.spec.ts
    └── ingestion-flow.integration.spec.ts
```

### Unit Test Coverage Targets

- Configuration validation: Test all required/optional variables, invalid formats
- Repository methods: Test CRUD operations, constraint violations, edge cases
- HTTP client: Test timeout, retry logic, header handling, error cases
- Provider mapping: Test DTO transformations with various input formats
- Ingestion service: Test job execution flow, error handling, state transitions
- API controllers: Test validation, error responses, pagination, filtering
- Health checks: Test with database up/down scenarios

### Property Test Coverage

Each correctness property (Properties 1-45) should have a corresponding property-based test that:
1. Generates random valid inputs using fast-check arbitraries
2. Executes the system behavior
3. Asserts the property holds
4. Runs for minimum 100 iterations
5. Includes the property reference comment

### Integration Test Scenarios

- Database migrations: Run migrations, verify schema, test rollback
- End-to-end API flows: Seed data → query endpoints → verify responses
- Ingestion job execution: Mock provider → run job → verify database state
- Error scenarios: Database down, provider timeout, invalid data

### Test Database Setup

Use a separate test database with the following approach:

```typescript
beforeAll(async () => {
  // Create test database connection
  testDataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5433, // Different port for test DB
    database: 'vnstock_test',
    synchronize: true, // OK for tests
    dropSchema: true, // Clean slate each run
    entities: [Symbol, QuoteDaily, QuoteIntraday, CrawlRun]
  });
  
  await testDataSource.initialize();
});

afterAll(async () => {
  await testDataSource.destroy();
});
```

### Continuous Integration

Tests should run in CI pipeline:
1. Lint and type check
2. Unit tests (fast, no external dependencies)
3. Property tests (may take longer due to iterations)
4. Integration tests (require test database)

Use GitHub Actions or similar with PostgreSQL service container for integration tests.

### Manual Testing Checklist

Before deployment, manually verify:
- [ ] Application starts with valid .env configuration
- [ ] Application fails fast with clear error for missing env vars
- [ ] /health endpoint returns 200 even when DB is down
- [ ] /health/db returns 200 when DB is up, 503 when down
- [ ] GET /symbols returns paginated results
- [ ] GET /symbols?search=AAA filters correctly
- [ ] GET /symbols/:symbol returns 404 for non-existent symbol
- [ ] GET /quotes/daily returns data for valid symbol and date range
- [ ] GET /quotes/intraday returns data with limit enforcement
- [ ] Ingestion jobs create crawl_runs records
- [ ] Logs are JSON in production, pretty in development
- [ ] CSV seeding populates symbols table
- [ ] Docker Compose starts PostgreSQL successfully

