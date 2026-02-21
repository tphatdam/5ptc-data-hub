import '../strapi-shim';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { logPayload, toLogError } from '../common/logging/ingestion-log';
import { SeedService } from '../modules/seed/seed.service';
import { seedDatabase } from '../modules/data-hub/seed/seed';
import { Symbol as LegacySymbol } from '../db/entities/symbol.entity';
import { Symbol as DataHubSymbol } from '../modules/data-hub/entities/symbol.entity';
import { Exchange as DataHubExchange } from '../modules/data-hub/entities/exchange.entity';

const DEFAULT_LOCK_KEY = 987654322;
const BATCH_SIZE = 500;

type LockResult = { acquired: boolean };

async function syncSymbolsToDataHub(
  dataSource: DataSource,
  logger: Logger,
  cycleId: string,
): Promise<number> {
  const legacyRepository: Repository<LegacySymbol> =
    dataSource.getRepository(LegacySymbol);
  const dataHubSymbolRepository: Repository<DataHubSymbol> =
    dataSource.getRepository(DataHubSymbol);
  const exchangeRepository: Repository<DataHubExchange> =
    dataSource.getRepository(DataHubExchange);

  const exchanges = await exchangeRepository.find();
  const exchangeMap = new Map(exchanges.map((exchange) => [exchange.code, exchange.id]));

  const legacySymbols = await legacyRepository.find();
  const payloads = legacySymbols
    .map((symbol) => {
      const exchangeId = exchangeMap.get(symbol.exchange || '');
      if (!exchangeId) {
        return null;
      }

      return {
        ticker: symbol.symbol,
        exchangeId,
        companyName: symbol.name || undefined,
        industry: symbol.industryCode || undefined,
        isActive: symbol.status !== 'INACTIVE',
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  for (let index = 0; index < payloads.length; index += BATCH_SIZE) {
    const batch = payloads.slice(index, index + BATCH_SIZE);
    await dataHubSymbolRepository.upsert(batch, ['ticker']);

    logger.log(
      logPayload({
        event: 'bootstrap_seed_batch_upserted',
        module: 'deploy',
        cycleId,
        status: 'running',
        processed: Math.min(index + batch.length, payloads.length),
        total: payloads.length,
      }),
    );
  }

  return payloads.length;
}

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
    const seedService = app.get(SeedService);

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
      await seedService.run();
      const synced = await syncSymbolsToDataHub(dataSource, logger, cycleId);

      logger.log(
        logPayload({
          event: 'bootstrap_seed_completed',
          module: 'deploy',
          cycleId,
          status: 'succeeded',
          durationMs: Date.now() - startedAt,
          processed: synced,
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
