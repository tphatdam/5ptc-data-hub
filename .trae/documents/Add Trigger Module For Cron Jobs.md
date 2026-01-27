## Goal
- Add a new NestJS module that exposes HTTP endpoints to manually trigger every scheduled cron job (both the DataHub `@Cron` jobs and the Ingestion `SchedulerRegistry` cron jobs).

## Scope (Jobs To Trigger)
- **IngestionService (SchedulerRegistry cron jobs)**
  - `quote-hourly` → `IngestionService.runQuoteHourly()`
  - `daily-company` → `IngestionService.runDailyCompany()`
- **DataHubModule (@Cron jobs)**
  - `IntradayMarketJob.handleCron()`
  - `EodDailyJob.handleCron()`
  - `FundamentalsJob.handleCron()`
  - `GoldJob.handleCron()`
  - `NewsJob.handleCron()`
  - `SymbolSyncJob.handleCron()`
  - `GapFillJob.handleCron()`

## API Design
- Create a `TriggerController` with these routes:
  - `GET /triggers` → list available triggers (names + what they call)
  - `POST /triggers/ingestion/quote-hourly`
  - `POST /triggers/ingestion/daily-company`
  - `POST /triggers/data-hub/intraday-market`
  - `POST /triggers/data-hub/eod-daily`
  - `POST /triggers/data-hub/fundamentals`
  - `POST /triggers/data-hub/gold`
  - `POST /triggers/data-hub/news`
  - `POST /triggers/data-hub/symbol-sync`
  - `POST /triggers/data-hub/gap-fill`
- Responses return a small JSON payload like `{ ok: true, job: "...", startedAt, finishedAt }` and surface errors with 500.

## Dependency Wiring
- Add `TriggerModule` that imports:
  - `IngestionModule` (so it can inject `IngestionService`)
  - `DataHubModule` (so it can inject job classes)
- Update `DataHubModule` exports to include the job providers (currently it does not export them), so `TriggerModule` can inject `IntradayMarketJob`, `EodDailyJob`, etc.
- Add `TriggerModule` to `AppModule.imports`.

## Safety / Access Control
- Add a minimal API-key guard `InternalApiKeyGuard`.
  - Reads `INTERNAL_API_KEY` from config.
  - Requires `x-api-key: <value>` header for all `/triggers/*` endpoints.
  - If `INTERNAL_API_KEY` is missing, endpoints reject (so triggers aren’t accidentally public).
- Add `INTERNAL_API_KEY` to env validation as optional-but-enforced-by-guard.

## Verification
- Ensure TypeScript build passes (`npm run build`).
- Smoke-check controller wiring by booting the app and calling `GET /triggers` and one `POST /triggers/...` endpoint (without running heavy external calls if not desired).

## Files To Add / Update
- Add: `src/trigger/trigger.module.ts`, `src/trigger/trigger.controller.ts`
- Add: `src/common/guards/internal-api-key.guard.ts` (or `src/trigger/internal-api-key.guard.ts`)
- Update: `src/data-hub/data-hub.module.ts` (export job providers)
- Update: `src/app.module.ts` (import TriggerModule)
- Update: `src/config/validate-env.ts` (add `INTERNAL_API_KEY` optional)
