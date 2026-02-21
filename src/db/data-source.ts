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
  const baseConfig: DataSourceOptions = {
    type: 'postgres',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
  };

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const ssl = getDatabaseSslOption(databaseUrl);
    return {
      ...baseConfig,
      url: databaseUrl,
      ...(ssl !== undefined && { ssl }),
    };
  }

  return {
    ...baseConfig,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'vnstock_hub',
  };
};

// Create and export the DataSource instance
export const AppDataSource = new DataSource(getDatabaseConfig());
