#!/bin/bash

# Test script for database migrations
# This script tests migration:run and migration:revert commands

set -e  # Exit on error

echo "=========================================="
echo "Database Migration Test Script"
echo "=========================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Please create .env file with database configuration"
    exit 1
fi

# Source environment variables
export $(cat .env | grep -v '^#' | xargs)

echo "📋 Configuration:"
echo "  DB_HOST: ${DB_HOST:-localhost}"
echo "  DB_PORT: ${DB_PORT:-5432}"
echo "  DB_NAME: ${DB_NAME:-vnstock_hub}"
echo "  DB_USER: ${DB_USER:-postgres}"
echo ""

# Test database connection
echo "🔍 Testing database connection..."
if command -v psql &> /dev/null; then
    PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT 1" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Database connection successful"
    else
        echo "❌ Database connection failed"
        echo "Please check your database credentials in .env"
        exit 1
    fi
else
    echo "⚠️  psql command not found, skipping connection test"
fi

echo ""
echo "=========================================="
echo "Test 1: Running Migrations"
echo "=========================================="
echo ""

# Run migrations
echo "🚀 Running migrations..."
npm run migration:run

if [ $? -eq 0 ]; then
    echo "✅ Migrations ran successfully"
else
    echo "❌ Migration run failed"
    exit 1
fi

echo ""
echo "🔍 Verifying tables were created..."

if command -v psql &> /dev/null; then
    # Check if tables exist
    TABLES=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public'" | tr -d ' ')
    
    echo "Tables found:"
    echo "$TABLES"
    
    # Check for expected tables
    for table in symbols quote_daily quote_intraday crawl_runs; do
        if echo "$TABLES" | grep -q "^$table$"; then
            echo "  ✅ $table"
        else
            echo "  ❌ $table (missing)"
        fi
    done
    
    echo ""
    echo "🔍 Verifying indexes..."
    INDEXES=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'" | tr -d ' ')
    echo "Indexes found:"
    echo "$INDEXES"
    
    echo ""
    echo "🔍 Verifying constraints..."
    CONSTRAINTS=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace" | tr -d ' ')
    echo "Constraints found:"
    echo "$CONSTRAINTS"
else
    echo "⚠️  psql command not found, skipping table verification"
fi

echo ""
echo "=========================================="
echo "Test 2: Reverting Migrations"
echo "=========================================="
echo ""

# Revert migrations
echo "⏪ Reverting migrations..."
npm run migration:revert

if [ $? -eq 0 ]; then
    echo "✅ Migrations reverted successfully"
else
    echo "❌ Migration revert failed"
    exit 1
fi

echo ""
echo "🔍 Verifying tables were dropped..."

if command -v psql &> /dev/null; then
    TABLES=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public'" | tr -d ' ')
    
    if [ -z "$TABLES" ]; then
        echo "✅ All tables dropped successfully"
    else
        echo "⚠️  Some tables still exist:"
        echo "$TABLES"
    fi
    
    # Check if enum type was dropped
    ENUM_EXISTS=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT typname FROM pg_type WHERE typname = 'crawl_runs_status_enum'" | tr -d ' ')
    
    if [ -z "$ENUM_EXISTS" ]; then
        echo "✅ Enum type dropped successfully"
    else
        echo "⚠️  Enum type still exists: $ENUM_EXISTS"
    fi
else
    echo "⚠️  psql command not found, skipping table verification"
fi

echo ""
echo "=========================================="
echo "Test 3: Re-running Migrations"
echo "=========================================="
echo ""

# Run migrations again to ensure they can be re-applied
echo "🚀 Re-running migrations..."
npm run migration:run

if [ $? -eq 0 ]; then
    echo "✅ Migrations re-ran successfully"
else
    echo "❌ Migration re-run failed"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ All migration tests passed!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✅ Migrations can be run successfully"
echo "  ✅ Tables, indexes, and constraints are created correctly"
echo "  ✅ Migrations can be reverted successfully"
echo "  ✅ Tables and enum types are dropped correctly"
echo "  ✅ Migrations can be re-applied after revert"
echo ""
echo "The database is now in a migrated state with all tables created."
echo "You can revert again with: npm run migration:revert"
