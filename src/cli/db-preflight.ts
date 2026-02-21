import 'dotenv/config';
import { AppDataSource } from '../db/data-source';
import { logPayload, toLogError } from '../common/logging/ingestion-log';

const CORE_TABLES = ['symbols', 'quote_daily', 'quote_intraday'];

type TableRow = { table_name: string };
type MigrationCountRow = { count: string };
type RegclassRow = { regclass: string | null };

async function runPreflight(): Promise<void> {
  const startedAt = Date.now();
  const cycleId = `db-preflight:${new Date().toISOString()}`;

  console.log(
    logPayload({
      event: 'db_preflight_started',
      module: 'deploy',
      cycleId,
      status: 'started',
    }),
  );

  try {
    await AppDataSource.initialize();

    const migrationTableResult = await AppDataSource.query(
      `SELECT to_regclass('public.migrations') as regclass`,
    );
    const migrationRows = migrationTableResult as RegclassRow[];
    const migrationTableExists = migrationRows[0]?.regclass !== null;

    let migrationCount = 0;
    if (migrationTableExists) {
      const migrationCountResult = (await AppDataSource.query(
        `SELECT COUNT(*)::text as count FROM "migrations"`,
      )) as MigrationCountRow[];
      migrationCount = Number.parseInt(migrationCountResult[0]?.count || '0', 10);
    }

    const coreTableResult = (await AppDataSource.query(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      `,
      [CORE_TABLES],
    )) as TableRow[];

    const existingCoreTables = coreTableResult.map((row) => row.table_name);
    if (migrationCount === 0 && existingCoreTables.length > 0) {
      throw new Error(
        [
          'Dirty database detected: core tables already exist but migration baseline is missing.',
          `Core tables found: ${existingCoreTables.join(', ')}.`,
          'Suggested actions:',
          '1) Drop/recreate the database for a clean setup, or',
          '2) Baseline the migrations table before running migration:run.',
        ].join(' '),
      );
    }

    console.log(
      logPayload({
        event: 'db_preflight_completed',
        module: 'deploy',
        cycleId,
        status: 'succeeded',
        durationMs: Date.now() - startedAt,
        migrationCount,
        coreTablesDetected: existingCoreTables.length,
      }),
    );
  } catch (error: unknown) {
    console.error(
      logPayload({
        event: 'db_preflight_failed',
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

runPreflight().catch(() => {
  process.exit(1);
});
