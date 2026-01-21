# Database Setup Guide for vnstock-hub

This guide will help you set up the PostgreSQL database for vnstock-hub.

## Prerequisites

You need PostgreSQL installed and running. Choose one of the following options:

### Option 1: Using Docker (Recommended for Development)

If you don't have PostgreSQL installed, the easiest way is to use Docker:

```bash
# Create a docker-compose.yml file (see below)
# Then start PostgreSQL
docker-compose up -d
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: vnstock-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres123
      POSTGRES_DB: vnstock_hub
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### Option 2: Using Local PostgreSQL Installation

If you have PostgreSQL installed locally:

1. Ensure PostgreSQL is running
2. Note your PostgreSQL credentials (username, password, port)

## Configuration Steps

### Step 1: Update .env File

Edit your `.env` file with the correct database credentials:

**For Docker setup:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres123
DB_NAME=vnstock_hub
```

**For local PostgreSQL:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_postgres_username
DB_PASS=your_postgres_password
DB_NAME=vnstock_hub
```

**Alternative: Using DATABASE_URL**
```env
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/vnstock_hub
```

### Step 2: Run the Verification Script

Once your database is running and .env is configured, run:

```bash
node verify-database-setup.js
```

This script will:
1. ✓ Test connection to PostgreSQL server
2. ✓ Create the `vnstock_hub` database if it doesn't exist
3. ✓ Enable the UUID extension
4. ✓ Run all migrations
5. ✓ Verify all tables are created (symbols, quote_daily, quote_intraday, crawl_runs)
6. ✓ Verify all constraints (primary keys, foreign keys, unique constraints)
7. ✓ Verify all indexes
8. ✓ Verify enum types
9. ✓ Test connection with DATABASE_URL format
10. ✓ Test connection with discrete variables

### Step 3: Verify Success

If all checks pass, you'll see:

```
✓ ALL CHECKS PASSED - Database setup is complete!

You can now proceed with repository implementations.
```

## Troubleshooting

### Error: "password authentication failed for user postgres"

**Solution:** Update the `DB_PASS` in your `.env` file with the correct PostgreSQL password.

### Error: "Connection refused"

**Solution:** 
- Ensure PostgreSQL is running
- Check that the port (default 5432) is correct
- If using Docker, run `docker-compose up -d` first

### Error: "database does not exist"

**Solution:** The script will automatically create the database. If it fails, you can manually create it:

```bash
# Using psql
psql -U postgres -c "CREATE DATABASE vnstock_hub;"

# Or using Docker
docker exec -it vnstock-postgres psql -U postgres -c "CREATE DATABASE vnstock_hub;"
```

### Error: "uuid-ossp extension not available"

**Solution:** This extension is usually included with PostgreSQL. If missing, install it:

```bash
# On Ubuntu/Debian
sudo apt-get install postgresql-contrib

# On macOS with Homebrew
brew install postgresql
```

## Manual Verification (Optional)

If you want to manually verify the database setup:

```bash
# Connect to the database
psql -U postgres -d vnstock_hub

# List all tables
\dt

# Describe each table
\d symbols
\d quote_daily
\d quote_intraday
\d crawl_runs

# List all indexes
\di

# List all constraints
SELECT conname, contype, conrelid::regclass AS table
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, conname;

# Exit psql
\q
```

## Next Steps

After successful database setup:

1. ✓ Database is ready for development
2. ✓ You can proceed with Task 6: Implement repository services
3. ✓ You can run the application with `npm run start:dev`

## Quick Start Commands

```bash
# 1. Start PostgreSQL (if using Docker)
docker-compose up -d

# 2. Update .env with correct credentials
# (Edit .env file)

# 3. Run verification script
node verify-database-setup.js

# 4. Start the application
npm run start:dev
```

## Database Schema Overview

After setup, you'll have these tables:

- **symbols**: Stock symbol master data (id, symbol, exchange, name, etc.)
- **quote_daily**: End-of-day OHLCV data
- **quote_intraday**: Intraday tick data
- **crawl_runs**: Ingestion job execution tracking

All tables have proper:
- Primary keys (UUID)
- Foreign key relationships
- Unique constraints
- Indexes for query performance
- Timestamps for audit trails
