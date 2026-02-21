import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { getDatabaseSslOption } from '../../../config/database-url';
import { seedDatabase } from './seed';
import * as entities from '../entities';

config();

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const ssl = getDatabaseSslOption(databaseUrl);

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: Object.values(entities),
    synchronize: false,
    logging: false,
    ...(ssl !== undefined && { ssl }),
  });

  await dataSource.initialize();

  try {
    await seedDatabase(dataSource);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
