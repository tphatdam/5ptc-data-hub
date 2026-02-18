import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as entities from './entities';
import { CreateDataHubSchema1705312800000 } from './migrations/1705312800000-CreateDataHubSchema';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: Object.values(entities),
  migrations: [CreateDataHubSchema1705312800000],
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
});
