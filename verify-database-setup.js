#!/usr/bin/env node

/**
 * Database Setup Verification Script
 * 
 * This script performs comprehensive verification of the database setup:
 * 1. Tests database connection
 * 2. Creates database if it doesn't exist
 * 3. Runs migrations
 * 4. Verifies all tables, constraints, and indexes
 * 5. Tests with both DATABASE_URL and discrete variables
 */

const { Client } = require('pg');
const { execSync } = require('child_process');
const fs = require('fs');
require('dotenv').config();

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

// Get database configuration
function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'vnstock_hub',
  };
}

// Test connection to PostgreSQL server
async function testServerConnection() {
  logSection('Step 1: Testing PostgreSQL Server Connection');
  
  const config = getDbConfig();
  const client = new Client({
    ...config,
    database: 'postgres', // Connect to default database
  });

  try {
    await client.connect();
    logSuccess('Connected to PostgreSQL server');
    
    const result = await client.query('SELECT version()');
    logInfo(`PostgreSQL version: ${result.rows[0].version.split(',')[0]}`);
    
    await client.end();
    return true;
  } catch (error) {
    logError(`Failed to connect to PostgreSQL server: ${error.message}`);
    logInfo('Please ensure:');
    logInfo('  1. PostgreSQL is running');
    logInfo('  2. Connection details in .env are correct');
    logInfo('  3. Password is set correctly (not "your_password_here")');
    return false;
  }
}

// Create database if it doesn't exist
async function ensureDatabaseExists() {
  logSection('Step 2: Ensuring Database Exists');
  
  const config = getDbConfig();
  const client = new Client({
    ...config,
    database: 'postgres',
  });

  try {
    await client.connect();
    
    // Check if database exists
    const result = await client.query(
      'SELECT datname FROM pg_database WHERE datname = $1',
      [config.database]
    );
    
    if (result.rows.length > 0) {
      logSuccess(`Database '${config.database}' already exists`);
    } else {
      logInfo(`Creating database '${config.database}'...`);
      await client.query(`CREATE DATABASE ${config.database}`);
      logSuccess(`Database '${config.database}' created successfully`);
    }
    
    await client.end();
    return true;
  } catch (error) {
    logError(`Failed to ensure database exists: ${error.message}`);
    return false;
  }
}

// Enable UUID extension
async function enableUuidExtension() {
  logSection('Step 3: Enabling UUID Extension');
  
  const config = getDbConfig();
  const client = new Client(config);

  try {
    await client.connect();
    
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    logSuccess('UUID extension enabled');
    
    await client.end();
    return true;
  } catch (error) {
    logError(`Failed to enable UUID extension: ${error.message}`);
    return false;
  }
}

// Run migrations
async function runMigrations() {
  logSection('Step 4: Running Migrations');
  
  try {
    logInfo('Executing: npm run migration:run');
    const output = execSync('npm run migration:run', { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    console.log(output);
    
    if (output.includes('No migrations are pending') || 
        output.includes('migrations have been executed successfully')) {
      logSuccess('Migrations completed successfully');
      return true;
    } else {
      logWarning('Migration output unclear, will verify schema manually');
      return true;
    }
  } catch (error) {
    logError(`Migration failed: ${error.message}`);
    if (error.stdout) {
      console.log(error.stdout.toString());
    }
    if (error.stderr) {
      console.error(error.stderr.toString());
    }
    return false;
  }
}

// Verify tables exist
async function verifyTables() {
  logSection('Step 5: Verifying Tables');
  
  const config = getDbConfig();
  const client = new Client(config);
  
  const expectedTables = ['symbols', 'quote_daily', 'quote_intraday', 'crawl_runs'];

  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    const actualTables = result.rows.map(row => row.tablename);
    
    let allTablesExist = true;
    for (const table of expectedTables) {
      if (actualTables.includes(table)) {
        logSuccess(`Table '${table}' exists`);
      } else {
        logError(`Table '${table}' is missing`);
        allTablesExist = false;
      }
    }
    
    await client.end();
    return allTablesExist;
  } catch (error) {
    logError(`Failed to verify tables: ${error.message}`);
    return false;
  }
}

// Verify constraints
async function verifyConstraints() {
  logSection('Step 6: Verifying Constraints');
  
  const config = getDbConfig();
  const client = new Client(config);
  
  const expectedConstraints = [
    { table: 'symbols', name: 'PK_symbols_id', type: 'p' },
    { table: 'symbols', name: 'UQ_symbols_symbol', type: 'u' },
    { table: 'quote_daily', name: 'PK_quote_daily_id', type: 'p' },
    { table: 'quote_daily', name: 'UQ_quote_daily_symbolId_date_source', type: 'u' },
    { table: 'quote_daily', name: 'FK_quote_daily_symbolId', type: 'f' },
    { table: 'quote_intraday', name: 'PK_quote_intraday_id', type: 'p' },
    { table: 'quote_intraday', name: 'UQ_quote_intraday_symbolId_ts_source', type: 'u' },
    { table: 'quote_intraday', name: 'FK_quote_intraday_symbolId', type: 'f' },
    { table: 'crawl_runs', name: 'PK_crawl_runs_id', type: 'p' },
  ];

  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT 
        c.conname as name,
        c.contype as type,
        t.relname as table
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      ORDER BY t.relname, c.conname
    `);
    
    const actualConstraints = result.rows;
    
    let allConstraintsExist = true;
    for (const expected of expectedConstraints) {
      const found = actualConstraints.find(
        c => c.table === expected.table && 
             c.name === expected.name && 
             c.type === expected.type
      );
      
      if (found) {
        const typeLabel = { p: 'PRIMARY KEY', u: 'UNIQUE', f: 'FOREIGN KEY' }[expected.type];
        logSuccess(`${expected.table}.${expected.name} (${typeLabel})`);
      } else {
        logError(`Missing constraint: ${expected.table}.${expected.name}`);
        allConstraintsExist = false;
      }
    }
    
    await client.end();
    return allConstraintsExist;
  } catch (error) {
    logError(`Failed to verify constraints: ${error.message}`);
    return false;
  }
}

// Verify indexes
async function verifyIndexes() {
  logSection('Step 7: Verifying Indexes');
  
  const config = getDbConfig();
  const client = new Client(config);
  
  const expectedIndexes = [
    'IDX_symbols_symbol',
    'IDX_quote_daily_symbolId_date',
    'IDX_quote_intraday_symbolId_ts',
  ];

  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname LIKE 'IDX_%'
      ORDER BY indexname
    `);
    
    const actualIndexes = result.rows.map(row => row.indexname);
    
    let allIndexesExist = true;
    for (const index of expectedIndexes) {
      if (actualIndexes.includes(index)) {
        logSuccess(`Index '${index}' exists`);
      } else {
        logError(`Index '${index}' is missing`);
        allIndexesExist = false;
      }
    }
    
    await client.end();
    return allIndexesExist;
  } catch (error) {
    logError(`Failed to verify indexes: ${error.message}`);
    return false;
  }
}

// Test connection with DATABASE_URL
async function testDatabaseUrl() {
  logSection('Step 8: Testing DATABASE_URL Connection');
  
  const config = getDbConfig();
  const databaseUrl = `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;
  
  logInfo(`Testing connection with DATABASE_URL format...`);
  
  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    await client.connect();
    logSuccess('Successfully connected using DATABASE_URL format');
    
    const result = await client.query('SELECT COUNT(*) FROM symbols');
    logInfo(`Symbols table accessible (${result.rows[0].count} rows)`);
    
    await client.end();
    return true;
  } catch (error) {
    logError(`Failed to connect with DATABASE_URL: ${error.message}`);
    return false;
  }
}

// Test connection with discrete variables
async function testDiscreteVariables() {
  logSection('Step 9: Testing Discrete Variables Connection');
  
  const config = getDbConfig();
  
  logInfo('Testing connection with discrete DB_* variables...');
  
  const client = new Client(config);

  try {
    await client.connect();
    logSuccess('Successfully connected using discrete variables');
    
    const result = await client.query('SELECT COUNT(*) FROM quote_daily');
    logInfo(`quote_daily table accessible (${result.rows[0].count} rows)`);
    
    await client.end();
    return true;
  } catch (error) {
    logError(`Failed to connect with discrete variables: ${error.message}`);
    return false;
  }
}

// Verify enum type
async function verifyEnumType() {
  logSection('Step 10: Verifying Enum Types');
  
  const config = getDbConfig();
  const client = new Client(config);

  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT 
        t.typname as enum_name,
        e.enumlabel as enum_value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      WHERE t.typname = 'crawl_runs_status_enum'
      ORDER BY e.enumsortorder
    `);
    
    if (result.rows.length === 0) {
      logError('Enum type crawl_runs_status_enum not found');
      await client.end();
      return false;
    }
    
    const expectedValues = ['RUNNING', 'SUCCESS', 'FAILED'];
    const actualValues = result.rows.map(row => row.enum_value);
    
    let allValuesExist = true;
    for (const value of expectedValues) {
      if (actualValues.includes(value)) {
        logSuccess(`Enum value '${value}' exists`);
      } else {
        logError(`Enum value '${value}' is missing`);
        allValuesExist = false;
      }
    }
    
    await client.end();
    return allValuesExist;
  } catch (error) {
    logError(`Failed to verify enum type: ${error.message}`);
    return false;
  }
}

// Main verification function
async function main() {
  console.log('\n');
  log('╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║     vnstock-hub Database Setup Verification Script        ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');
  
  const results = {
    serverConnection: false,
    databaseExists: false,
    uuidExtension: false,
    migrations: false,
    tables: false,
    constraints: false,
    indexes: false,
    databaseUrl: false,
    discreteVariables: false,
    enumType: false,
  };

  // Run all verification steps
  results.serverConnection = await testServerConnection();
  if (!results.serverConnection) {
    logError('\nCannot proceed without database connection. Please fix connection issues.');
    process.exit(1);
  }

  results.databaseExists = await ensureDatabaseExists();
  if (!results.databaseExists) {
    logError('\nCannot proceed without database. Please fix database creation issues.');
    process.exit(1);
  }

  results.uuidExtension = await enableUuidExtension();
  results.migrations = await runMigrations();
  results.tables = await verifyTables();
  results.constraints = await verifyConstraints();
  results.indexes = await verifyIndexes();
  results.enumType = await verifyEnumType();
  results.databaseUrl = await testDatabaseUrl();
  results.discreteVariables = await testDiscreteVariables();

  // Summary
  logSection('Verification Summary');
  
  const checks = [
    ['PostgreSQL Server Connection', results.serverConnection],
    ['Database Exists', results.databaseExists],
    ['UUID Extension Enabled', results.uuidExtension],
    ['Migrations Executed', results.migrations],
    ['All Tables Created', results.tables],
    ['All Constraints Created', results.constraints],
    ['All Indexes Created', results.indexes],
    ['Enum Type Created', results.enumType],
    ['DATABASE_URL Connection', results.databaseUrl],
    ['Discrete Variables Connection', results.discreteVariables],
  ];

  let allPassed = true;
  for (const [check, passed] of checks) {
    if (passed) {
      logSuccess(check);
    } else {
      logError(check);
      allPassed = false;
    }
  }

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    log('✓ ALL CHECKS PASSED - Database setup is complete!', 'green');
    log('\nYou can now proceed with repository implementations.', 'cyan');
  } else {
    log('✗ SOME CHECKS FAILED - Please review the errors above', 'red');
    process.exit(1);
  }
  console.log('='.repeat(60) + '\n');
}

// Run the verification
main().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
