import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { getDatabaseSslOption } from '../config/database-url';

// Load environment variables
config();

/**
 * TypeORM DataSource configuration for CLI operations (migrations)
 * This file is used by TypeORM CLI commands for migration generation and execution
 */

const getDatabaseConfig = (): DataSourceOptions => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for migrations');
  }
  const ssl = getDatabaseSslOption(databaseUrl);
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [
      __dirname + '/migrations/*{.ts,.js}',
      __dirname + '/../modules/data-hub/migrations/*{.ts,.js}',
    ],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
    ...(ssl !== undefined && { ssl }),
  } as DataSourceOptions;
};

// Create and export the DataSource instance
export const AppDataSource = new DataSource(getDatabaseConfig());
