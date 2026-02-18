# Source layout

Domain-oriented NestJS structure. Feature code lives under `modules/`; shared kernel stays at `src` root.

## Root

- `main.ts`, `app.module.ts`, `strapi-shim.ts` — entry and app wiring
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
| `company-data` | Company/report/news repositories (TypeORM) |
| `company-intel` | Thin re-export of company-data |
| `data-hub` | Jobs, providers, entities (TCBS, intraday, etc.) |
| `health` | Health check controller |
| `ingestion` | Core ingestion service and crawl runs |
| `market-ingestion` | Trigger API and use cases (application/domain/infrastructure/presentation) |
| `market-pricing` | Thin re-export of quotes |
| `market-reference` | Thin re-export of symbols |
| `providers` | HTTP client, VCI, Simplize, market provider interface |
| `queue` | Bull/BullMQ queues and processors |
| `quotes` | Quote daily/intraday repositories |
| `reporting` | PDF and daily stock report (PdfModule + DailyStockReportModule) |
| `seed` | Symbol seeding (CLI and queue processor) |
| `symbols` | Symbols repository |

The `/triggers` API is served by `market-ingestion` (v1-compat and v2 controllers).
