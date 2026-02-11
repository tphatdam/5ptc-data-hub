import '../strapi-shim';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedService } from './seed.service';
import { Logger } from '@nestjs/common';

function parseArgv(): { source: 'sstock' | 'static'; fallback: boolean } {
  let source: 'sstock' | 'static' = 'sstock';
  let fallback = true;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--source=')) {
      const v = arg.slice('--source='.length).toLowerCase();
      if (v === 'sstock' || v === 'static') source = v;
    }
    if (arg.startsWith('--fallback=')) {
      const v = arg.slice('--fallback='.length).toLowerCase();
      fallback = v === 'true' || v === '1';
    }
  }
  return { source, fallback };
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const seedService = app.get(SeedService);
  const logger = app.get(Logger);
  const { source, fallback } = parseArgv();
  logger.log(`Running seed (source=${source}, fallback=${fallback})`);
  try {
    await seedService.run({ source, fallback });
    logger.log('Seed finished successfully');
    await app.close();
    process.exit(0);
  } catch (err: any) {
    logger.error(err?.message ?? String(err));
    await app.close();
    process.exit(1);
  }
}

main();
