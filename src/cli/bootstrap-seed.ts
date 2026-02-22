import '../strapi-shim';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { logPayload, toLogError } from '../common/logging/ingestion-log';
import { seedDatabase } from '../modules/data-hub/seed/seed';

const DEFAULT_LOCK_KEY = 987654322;

type LockResult = { acquired: boolean };

async function main(): Promise<void> {
  const logger = new Logger('BootstrapSeedCli');
  const cycleId = `bootstrap-seed:${new Date().toISOString()}`;
  const startedAt = Date.now();
  const lockKey = Number.parseInt(
    process.env.BOOTSTRAP_SEED_ADVISORY_LOCK_KEY || String(DEFAULT_LOCK_KEY),
    10,
  );

  logger.log(
    logPayload({
      event: 'bootstrap_seed_started',
      module: 'deploy',
      cycleId,
      status: 'started',
    }),
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const dataSource = app.get(DataSource);

    const lockResult = await dataSource.query<LockResult[]>(
      'SELECT pg_try_advisory_lock($1) as acquired',
      [lockKey],
    );

    if (!lockResult[0]?.acquired) {
      logger.warn(
        logPayload({
          event: 'bootstrap_seed_skipped_lock_held',
          module: 'deploy',
          cycleId,
          status: 'skipped',
        }),
      );
      return;
    }

    try {
      await seedDatabase(dataSource);

      logger.log(
        logPayload({
          event: 'bootstrap_seed_completed',
          module: 'deploy',
          cycleId,
          status: 'succeeded',
          durationMs: Date.now() - startedAt,
          processed: 0,
        }),
      );
    } finally {
      await dataSource.query('SELECT pg_advisory_unlock($1)', [lockKey]);
    }
  } catch (error: unknown) {
    logger.error(
      logPayload({
        event: 'bootstrap_seed_failed',
        module: 'deploy',
        cycleId,
        status: 'failed',
        durationMs: Date.now() - startedAt,
        error: toLogError(error),
      }),
    );
    throw error;
  } finally {
    await app.close();
  }
}

main().catch(() => {
  process.exit(1);
});
