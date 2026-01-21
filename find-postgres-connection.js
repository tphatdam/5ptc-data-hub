#!/usr/bin/env node

/**
 * PostgreSQL Connection Finder
 * 
 * This script helps identify the correct PostgreSQL connection parameters
 */

const { Client } = require('pg');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testConnection(config) {
  const client = new Client(config);
  try {
    await client.connect();
    await client.query('SELECT version()');
    await client.end();
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     PostgreSQL Connection Configuration Helper            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  console.log('PostgreSQL is running on your system. Let\'s find the correct credentials.\n');
  
  // Try common configurations
  const commonConfigs = [
    { user: 'postgres', password: '', database: 'postgres', description: 'No password' },
    { user: 'postgres', password: 'postgres', database: 'postgres', description: 'Password: postgres' },
    { user: 'postgres', password: 'postgres123', database: 'postgres', description: 'Password: postgres123' },
    { user: process.env.USER, password: '', database: 'postgres', description: `User: ${process.env.USER}, no password` },
  ];
  
  console.log('Testing common configurations...\n');
  
  for (const config of commonConfigs) {
    process.stdout.write(`Testing ${config.description}... `);
    const success = await testConnection({
      host: 'localhost',
      port: 5432,
      ...config
    });
    
    if (success) {
      console.log('✓ SUCCESS!\n');
      console.log('Found working configuration:');
      console.log('─'.repeat(60));
      console.log(`DB_HOST=localhost`);
      console.log(`DB_PORT=5432`);
      console.log(`DB_USER=${config.user}`);
      console.log(`DB_PASS=${config.password}`);
      console.log(`DB_NAME=vnstock_hub`);
      console.log('─'.repeat(60));
      console.log('\nUpdate your .env file with these values.\n');
      rl.close();
      return;
    } else {
      console.log('✗ Failed');
    }
  }
  
  console.log('\nCommon configurations didn\'t work. Let\'s try manual entry.\n');
  
  const user = await question('PostgreSQL username (default: postgres): ') || 'postgres';
  const password = await question('PostgreSQL password (press Enter if no password): ');
  const port = await question('PostgreSQL port (default: 5432): ') || '5432';
  
  console.log('\nTesting your configuration...');
  
  const success = await testConnection({
    host: 'localhost',
    port: parseInt(port),
    user,
    password,
    database: 'postgres'
  });
  
  if (success) {
    console.log('✓ SUCCESS!\n');
    console.log('Working configuration:');
    console.log('─'.repeat(60));
    console.log(`DB_HOST=localhost`);
    console.log(`DB_PORT=${port}`);
    console.log(`DB_USER=${user}`);
    console.log(`DB_PASS=${password}`);
    console.log(`DB_NAME=vnstock_hub`);
    console.log('─'.repeat(60));
    console.log('\nUpdate your .env file with these values.\n');
  } else {
    console.log('✗ Connection failed.\n');
    console.log('Please check:');
    console.log('1. PostgreSQL is running (it appears to be)');
    console.log('2. The username and password are correct');
    console.log('3. PostgreSQL is configured to accept local connections');
    console.log('\nYou may need to check pg_hba.conf for authentication settings.');
  }
  
  rl.close();
}

main().catch(error => {
  console.error('Error:', error.message);
  rl.close();
  process.exit(1);
});
