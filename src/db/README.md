# Database Module

This directory contains TypeORM entities, migrations, and database configuration for vnstock-hub.

## Structure (to be created):

- `data-source.ts` - TypeORM DataSource configuration for migrations
- `entities/` - TypeORM entity definitions
  - `symbol.entity.ts`
  - `quote-daily.entity.ts`
  - `quote-intraday.entity.ts`
  - `crawl-run.entity.ts`
- `migrations/` - TypeORM migration files

## Migration Pipeline

- One unified migration entrypoint: `src/db/data-source.ts`
- Includes migration directory:
  - `src/db/migrations`
- Official run command: `npm run migration:run`

## Purpose:

Manages database schema, entities, and migrations for the vnstock-hub application.
