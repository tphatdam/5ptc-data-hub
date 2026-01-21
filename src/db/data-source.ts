import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';

// Load environment variables
config();

/**
 * TypeORM DataSource configuration for CLI operations (migrations)
 * This file is used by TypeORM CLI commands for migration generation and execution
 */

// Determine if we should use DATABASE_URL or discrete connection parameters
const getDatabaseConfig = (): DataSourceOptions => {
  const baseConfig: Partial<DataSourceOptions> = {
    type: 'postgres',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    // Disable synchronize for production - use migrations instead
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
  };

  // Option 1: Use DATABASE_URL if provided
  if (process.env.DATABASE_URL) {
    return {
      ...baseConfig,
      url: process.env.DATABASE_URL,
    } as DataSourceOptions;
  }

  // Option 2: Use discrete connection parameters
  return {
    ...baseConfig,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'vnstock_hub',
  } as DataSourceOptions;
};

// Create and export the DataSource instance
export const AppDataSource = new DataSource(getDatabaseConfig());
