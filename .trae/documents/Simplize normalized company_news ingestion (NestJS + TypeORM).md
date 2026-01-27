## Scope
- Add a new raw-SQL TypeORM migration under `src/db/migrations/` to create 6 normalized Postgres tables (no vendor prefix): `foreign_trading_daily`, `insider_trading_events`, `stock_related_peers`, `company_subsidiaries`, `news_articles`, `company_reports`.
- Add matching TypeORM entities under `src/db/entities/` and export them via the entities barrel.
- Add 6 repositories with chunked (500) bulk upsert using raw SQL `INSERT ... ON CONFLICT DO UPDATE`.
- Add a Simplize provider (`src/providers/simplize`) using existing `HttpClientService` and config/env.
- Update `src/ingestion/ingestion.service.ts` scheduling + jobs to:
  - run `quote-hourly` every hour (store 1 intraday record per symbol per run)
  - run `daily-company` at 18:00 (foreign, insider, peers, subsidiaries, news, reports)
  - keep `crawl_runs` tracking and logging patterns.

## Repo Conventions Confirmed
- Migrations use raw SQL via `queryRunner.query(...)` like [InitialSchema](file:///Users/phat.dam/Workspace/Projects/5ptc/5ptc-data-hub/src/db/migrations/1700000000000-InitialSchema.ts).
- DB entities use `@PrimaryGeneratedColumn('uuid')`, `@Entity('table')`, and decorators for uniques/indexes like [QuoteDaily](file:///Users/phat.dam/Workspace/Projects/5ptc/5ptc-data-hub/src/db/entities/quote-daily.entity.ts).
- Bulk upsert repositories already exist for quotes with chunk size 500 and `ON CONFLICT` patterns: [QuoteDailyRepository](file:///Users/phat.dam/Workspace/Projects/5ptc/5ptc-data-hub/src/quotes/quote-daily.repository.ts) / [QuoteIntradayRepository](file:///Users/phat.dam/Workspace/Projects/5ptc/5ptc-data-hub/src/quotes/quote-intraday.repository.ts).
- Ingestion scheduling uses `CronJob` + `SchedulerRegistry` with config-driven cron/timezone: [IngestionService](file:///Users/phat.dam/Workspace/Projects/5ptc/5ptc-data-hub/src/ingestion/ingestion.service.ts).

## Step A — New Migration (Raw SQL)
- Create `src/db/migrations/1700xxxxxxxxxx-AddCompanyAndNewsTables.ts`.
- In `up()`:
  - Create each table with the exact columns/types/defaults you specified.
  - Add constraints:
    - FKs to `symbols(id)` for `symbolId` and `parentSymbolId`.
    - Uniques exactly as specified.
  - Add indexes exactly as specified:
    - `(symbolId, date)`, `(symbolId, transactionDate)`, `(symbolId, reportType)`
    - `publishedAt`
    - `GIN(tickers)` and `GIN(tags)`
- In `down()`:
  - Drop tables in reverse dependency order.
  - Drop indexes explicitly if the codebase style does so.

## Step B — Entities (`src/db/entities/*`)
Create:
- `foreign-trading-daily.entity.ts`
- `insider-trading-event.entity.ts`
- `stock-related-peer.entity.ts`
- `company-subsidiary.entity.ts`
- `news-article.entity.ts`
- `company-report.entity.ts`

Implementation details:
- Use `@Entity('table_name')`.
- Use `@PrimaryGeneratedColumn('uuid')`.
- Use `@Column({ name: '...', type: ... })` only when needed; keep camelCase properties.
- Add `@Unique([...])` and `@Index([...])` to match your constraints.
- Model relations the same way quotes do: `symbolId`/`parentSymbolId` column + `@ManyToOne(() => Symbol)` + `@JoinColumn({ name: '...' })`.
- For array columns in `news_articles`: `@Column({ type: 'text', array: true, nullable: true })` for `tickers` and `tags`.

## Step C — Repositories with Chunked Bulk Upsert
Create a new module folder `src/company-data/` and add repositories similar to quote repositories:
- `foreign-trading-daily.repository.ts`
- `insider-trading-event.repository.ts`
- `stock-related-peer.repository.ts`
- `company-subsidiary.repository.ts`
- `news-article.repository.ts`
- `company-report.repository.ts`

Rules:
- `bulkUpsert(rows)` returns total upserted rows.
- Chunk size 500.
- Use parameterized SQL.
- For bigint columns (`buyVolume`, `sellVolume`, `netVolume`, `quantity`) accept values as strings and cast in SQL with `::bigint` to avoid JS overflow.

## Step D — Simplize Provider
Create `src/providers/simplize/`:
- `simplize.module.ts` (exports `SimplizeService`)
- `simplize.service.ts` (HTTP calls)
- `mappers.ts` (pure mapping helpers + sha256)

Config/env:
- Add to config:
  - `SIMPLIZE_BASE_URL` default `https://api2.simplize.vn`
  - `SIMPLIZE_AUTH_TOKEN` optional
- Add schedule config updates:
  - `schedule.quoteHourlyCron` default `0 * * * *`
  - `schedule.dailyCompanyCron` default `0 18 * * *`
  - `schedule.timezone` default `Asia/Ho_Chi_Minh`
- I’ll also set the default HTTP retry count to 5 (still overridable by `HTTP_RETRIES`) so workflows match the “retry 5 times” reliability rule.

HTTP headers:
- Always send:
  - `Accept: application/json, text/plain, */*`
  - `Origin: https://simplize.vn`
  - `Referer: https://simplize.vn/`
- Conditionally send:
  - `Authorization: Bearer <token>` when `SIMPLIZE_AUTH_TOKEN` exists.

API methods (as requested):
- Quotes
  - `getLatestQuote(ticker)` → `GET {BASE}/api/historical/quote/{ticker}`
  - `getFullPriceHistory(ticker)` → paginate `GET {BASE}/api/historical/quote/prices/{ticker}?page=N&size=1000` until empty
- Company
  - `getForeignTrading(ticker)` → `GET {BASE}/api/historical/foreign/trade/{ticker}`
  - `getInsiderTimeline(ticker)` → `GET {BASE}/api/company/ownership/insider-trading-timeline/{ticker}`
  - `getRelatedCompanies(ticker)` → `GET {BASE}/api/company/company-related/{ticker}`
  - `getSubCompanies(ticker)` → `GET {BASE}/api/company/sub-company/{ticker}`
  - `getCompanyReports(ticker, reportType, page, size)` → `GET {BASE}/api/company/documents/list?...`
- News
  - `getNewsEvents(ticker, typeId, page, size)` → `GET {BASE}/api/company/events/list?...`

Pagination robustness:
- Implement a small pagination helper that can extract arrays from either `response`, `response.data`, or `response.items` shapes.
- Start `page=0`, and if the first page returns empty, attempt `page=1` once to tolerate 1-based APIs.

Mappers (`mappers.ts`):
- `sha256Hex(text)` using Node `crypto`.
- `mapLatestQuoteToIntraday(quote, symbolId, now)` chooses best available price field (tries `last`, `close`, `price`, etc.) and volume (defaults to `"0"`).
- `mapPriceHistoryToDailyBars(records, symbolId)` maps to `BulkUpsertQuoteDailyDto[]` with `source='SIMPLIZE'`.
- `mapForeignTradingToRows`, `mapInsiderTimelineToRows`, `mapRelatedToPeers`, `mapSubsidiaries`, `mapNewsEventsToArticles`, `mapReportsToRows` per your specs.
  - `news_articles.urlHash = sha256(url)` and `fetchedAt = now` and `tickers` includes the current ticker.
  - `company_reports.fileUrlHash = sha256(fileUrl)`.

## Step E — Ingestion Scheduling + New Jobs
Update `src/ingestion/ingestion.service.ts`:
- Scheduling registration (`onModuleInit`):
  - Replace `intraday-15m` with `quote-hourly` using `schedule.quoteHourlyCron`.
  - Replace `daily-eod` with `daily-company` using `schedule.dailyCompanyCron`.
  - Keep timezone support (`schedule.timezone`).
- Add job methods:
  - `runQuoteHourly()`:
    - create crawl run `{ jobName: 'quote-hourly', source: 'SIMPLIZE' }`
    - load active symbols via `SymbolsRepository.getAllActive()`
    - per symbol: call `SimplizeService.getLatestQuote`, map to one `BulkUpsertQuoteIntradayDto` with `ts = now`
    - `QuoteIntradayRepository.bulkUpsert`
    - mark success with stats `{ symbolsCount, symbolsSucceeded, errorsCount, rowsUpserted, durationMs }`
  - `runDailyCompany()`:
    - create crawl run `{ jobName: 'daily-company', source: 'SIMPLIZE' }`
    - per symbol try/catch (continue on error)
    - foreign/insider/related/subsidiaries/news/reports → map + bulkUpsert into new repositories
    - paginate news/reports until empty
    - mark success with aggregated counts `{ symbolsCount, errorsCount, rowsUpsertedByTable, durationMs }`
- Keep old methods if referenced elsewhere, but ensure new schedules call the new methods.

Crawl run stats typing:
- Broaden `CrawlRunsRepository` stats type so `statsJson` can store richer objects (e.g., `rowsUpsertedByTable`).

## Step F — Nest Modules Wiring
- Create `src/company-data/company-data.module.ts`:
  - `TypeOrmModule.forFeature([ForeignTradingDaily, InsiderTradingEvent, StockRelatedPeer, CompanySubsidiary, NewsArticle, CompanyReport])`
  - provide + export the 6 repositories
- Create `src/providers/simplize/simplize.module.ts`:
  - import `ProvidersModule` (to reuse `HttpClientService`) and `ConfigModule`
  - provide + export `SimplizeService`
- Update `src/ingestion/ingestion.module.ts`:
  - import `SimplizeModule` and `CompanyDataModule`
  - inject `SimplizeService` + new repositories into `IngestionService`

## Step G — Barrel Export + Migration Path
- Update `src/db/entities/index.ts` to export the 6 new entities.
- Confirmed `src/db/data-source.ts` already includes `src/db/migrations/*` glob, so the new migration will be picked up.

## Verification (After You Confirm Plan)
- Run TypeORM migrations against the configured DB to ensure the new migration applies cleanly.
- Compile TypeScript to ensure module wiring, DI, and imports are correct.
- Optionally run a one-off execution of `runQuoteHourly()` and `runDailyCompany()` in a controlled environment to validate API mapping and upsert behavior.

If you confirm, I’ll implement all files/changes end-to-end in the repo with the exact schemas/entities/upserts and updated ingestion schedules.