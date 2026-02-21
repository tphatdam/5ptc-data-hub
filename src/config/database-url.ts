/**
 * Derives SSL option for PostgreSQL from DATABASE_URL query params or DATABASE_SSL env.
 * Use when building TypeORM/DataSource options from DATABASE_URL.
 */
export function getDatabaseSslOption(
  databaseUrl: string | undefined,
): boolean | { rejectUnauthorized: boolean } | undefined {
  if (!databaseUrl) return undefined;
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: true };
  try {
    const url = new URL(databaseUrl);
    const sslmode = url.searchParams.get('sslmode');
    const ssl = url.searchParams.get('ssl');
    if (sslmode === 'require' || ssl === 'true') return { rejectUnauthorized: true };
  } catch {
    // ignore URL parse errors
  }
  return undefined;
}
