# Database Migrations

This directory contains TypeORM migrations for the vnstock-hub database schema.

## Available Migrations

### 1700000000000-InitialSchema.ts

Creates the initial database schema with the following tables:

1. **symbols** - Stock symbol master data
   - Primary key: `id` (uuid)
   - Unique constraint on `symbol` field
   - Fields: symbol, exchange, name, industryCode, status, createdAt, updatedAt

2. **quote_daily** - End-of-day OHLCV data
   - Primary key: `id` (uuid)
   - Foreign key: `symbolId` references symbols(id)
   - Unique constraint on (symbolId, date, source)
   - Index on (symbolId, date)
   - Fields: symbolId, date, open, high, low, close, volume, source, ingestedAt

3. **quote_intraday** - Intraday tick data
   - Primary key: `id` (uuid)
   - Foreign key: `symbolId` references symbols(id)
   - Unique constraint on (symbolId, ts, source)
   - Index on (symbolId, ts)
   - Fields: symbolId, ts, price, volume, source, ingestedAt

4. **crawl_runs** - Ingestion job execution tracking
   - Primary key: `id` (uuid)
   - Enum type: `crawl_runs_status_enum` (RUNNING, SUCCESS, FAILED)
   - Fields: jobName, source, startedAt, endedAt, status, errorText, statsJson

## Running Migrations

### Prerequisites

1. Ensure PostgreSQL is running
2. Configure database connection in `.env` file:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASS=your_password
   DB_NAME=vnstock_hub
   ```
   OR use DATABASE_URL:
   ```
   DATABASE_URL=postgresql://postgres:password@localhost:5432/vnstock_hub
   ```

### Commands

**Run all pending migrations:**
```bash
npm run migration:run
```

**Revert the last migration:**
```bash
npm run migration:revert
```

**Generate a new migration (after entity changes):**
```bash
npm run migration:generate -- src/db/migrations/MigrationName
```

## Testing Migrations

### Test migration:run

1. Ensure database is empty or in a known state
2. Run: `npm run migration:run`
3. Verify all tables are created:
   ```sql
   \dt  -- List all tables
   \d symbols  -- Describe symbols table
   \d quote_daily  -- Describe quote_daily table
   \d quote_intraday  -- Describe quote_intraday table
   \d crawl_runs  -- Describe crawl_runs table
   ```
4. Verify indexes:
   ```sql
   \di  -- List all indexes
   ```
5. Verify constraints:
   ```sql
   SELECT conname, contype FROM pg_constraint WHERE conrelid = 'symbols'::regclass;
   SELECT conname, contype FROM pg_constraint WHERE conrelid = 'quote_daily'::regclass;
   SELECT conname, contype FROM pg_constraint WHERE conrelid = 'quote_intraday'::regclass;
   ```

### Test migration:revert

1. After running migrations, execute: `npm run migration:revert`
2. Verify all tables are dropped:
   ```sql
   \dt  -- Should show no tables (or only pre-existing ones)
   ```
3. Verify enum types are dropped:
   ```sql
   SELECT typname FROM pg_type WHERE typname = 'crawl_runs_status_enum';
   -- Should return no rows
   ```

## Migration Verification Checklist

- [x] All entity fields are represented in migration
- [x] Primary keys are defined correctly (uuid with auto-generation)
- [x] Foreign key constraints are created
- [x] Unique constraints match entity decorators
- [x] Indexes are created for query optimization
- [x] Enum types are created for status fields
- [x] Nullable fields are correctly specified
- [x] Default values are set where appropriate
- [x] Down migration properly reverses all changes
- [x] Foreign key constraints are dropped before tables in down migration

## Troubleshooting

### Error: "relation already exists"
- The table already exists in the database
- Solution: Either drop the table manually or revert previous migrations

### Error: "password authentication failed"
- Database credentials in .env are incorrect
- Solution: Update DB_USER and DB_PASS in .env file

### Error: "database does not exist"
- The target database hasn't been created
- Solution: Create the database manually:
  ```bash
  createdb vnstock_hub
  ```
  Or using psql:
  ```sql
  CREATE DATABASE vnstock_hub;
  ```

### Error: "uuid_generate_v4() does not exist"
- PostgreSQL uuid-ossp extension is not installed
- Solution: Install the extension:
  ```sql
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  ```

## Notes

- Migrations are run in timestamp order (filename prefix)
- Each migration should be idempotent when possible
- Always test migrations in a development environment first
- Keep migrations small and focused on specific schema changes
- Document complex migrations with comments in the migration file
