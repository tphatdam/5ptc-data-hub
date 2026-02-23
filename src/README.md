# Source layout

Domain-oriented NestJS structure. Feature code lives under `modules/`; shared kernel stays at `src` root.

## Root

- `main.ts`, `app.module.ts` — entry and app wiring
- `config/` — configuration and env validation
- `common/` — shared guards, logging, S3, etc.
- `db/` — TypeORM entities, migrations, data-source
- `filters/`, `middlewares/` — HTTP filters and middlewares
- `types/`, `utils/` — shared types and utilities

## modules/

All feature modules are under `modules/<name>/`.

| Module | Role |
|--------|------|
| `ai` | OpenAI service and controller |
| `brevo` | Email (Brevo) |
| `data-hub` | Canonical data-hub entities, jobs, providers, seed orchestration |
| `exchange-provider` | Canonical aggregation module for exchange-data runtime |
| `health` | Health check controller |
| `market-company` | Company/intel facade over data-hub runtime |
| `market-content` | News/content facade over data-hub runtime |
| `market-core` | Shared market orchestration wiring |
| `market-ingestion` | Trigger API and use cases (application/domain/infrastructure/presentation) |
| `market-pricing` | Pricing facade over data-hub runtime |
| `market-reference` | Symbol/reference facade over data-hub runtime |
| `providers` | HTTP client, VCI, Simplize, market provider interface |
| `queue` | Bull/BullMQ queues and processors |
| `reporting` | PDF and daily stock report (PdfModule + DailyStockReportModule) |

The `/triggers` API is served by `market-ingestion` (v1-compat and v2 controllers).
