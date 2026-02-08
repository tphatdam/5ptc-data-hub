import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { seedDatabase } from './seed';
import * as entities from '../entities';

async function main() {
  strapi.log.info('Connecting to database...');
  
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: Object.values(entities),
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();
  strapi.log.info('Database connected.');

  try {
    await seedDatabase(dataSource);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    strapi.log.info('Database connection closed.');
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
