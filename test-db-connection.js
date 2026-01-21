const { Client } = require('pg');
require('dotenv').config();

async function testConnection() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    database: 'postgres', // Connect to default postgres database first
  });

  try {
    await client.connect();
    console.log('✓ Successfully connected to PostgreSQL server');
    
    // Check if vnstock_hub database exists
    const result = await client.query(
      "SELECT datname FROM pg_database WHERE datname = $1",
      [process.env.DB_NAME || 'vnstock_hub']
    );
    
    if (result.rows.length > 0) {
      console.log(`✓ Database '${process.env.DB_NAME || 'vnstock_hub'}' exists`);
    } else {
      console.log(`✗ Database '${process.env.DB_NAME || 'vnstock_hub'}' does not exist`);
      console.log(`  Creating database...`);
      await client.query(`CREATE DATABASE ${process.env.DB_NAME || 'vnstock_hub'}`);
      console.log(`✓ Database '${process.env.DB_NAME || 'vnstock_hub'}' created`);
    }
    
    await client.end();
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
