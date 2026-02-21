import 'dotenv/config';
import { AppDataSource } from '../db/data-source';
import { logPayload, toLogError } from '../common/logging/ingestion-log';

const CONFIRM_ENV_KEY = 'DB_CLEAR_CONFIRM';
const CONFIRM_VALUE = 'YES';

async function clearDatabase(): Promise<void> {
  const startedAt = Date.now();
  const cycleId = `db-clear:${new Date().toISOString()}`;

  console.log(
    logPayload({
      event: 'db_clear_started',
      module: 'deploy',
      cycleId,
      status: 'started',
    }),
  );

  if ((process.env[CONFIRM_ENV_KEY] || '').toUpperCase() !== CONFIRM_VALUE) {
    throw new Error(
      `Refusing to clear database. Set ${CONFIRM_ENV_KEY}=${CONFIRM_VALUE} to confirm.`,
    );
  }

  try {
    await AppDataSource.initialize();
    await AppDataSource.query('DROP SCHEMA IF EXISTS public CASCADE');
    await AppDataSource.query('CREATE SCHEMA public');
    await AppDataSource.query('GRANT ALL ON SCHEMA public TO public');

    console.log(
      logPayload({
        event: 'db_clear_completed',
        module: 'deploy',
        cycleId,
        status: 'succeeded',
        durationMs: Date.now() - startedAt,
      }),
    );
  } catch (error: unknown) {
    console.error(
      logPayload({
        event: 'db_clear_failed',
        module: 'deploy',
        cycleId,
        status: 'failed',
        durationMs: Date.now() - startedAt,
        error: toLogError(error),
      }),
    );
    throw error;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

clearDatabase().catch(() => {
  process.exit(1);
});
