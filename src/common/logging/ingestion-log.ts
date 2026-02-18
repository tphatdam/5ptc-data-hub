import { fromZonedTime, formatInTimeZone, toZonedTime } from 'date-fns-tz';

export interface IngestionLogContext {
  event: string;
  module: string;
  jobName?: string;
  cycleId?: string;
  jobRunId?: string;
  timeBucket?: string;
  queueName?: string;
  queueJobId?: string;
  symbolId?: number | string;
  ticker?: string;
  symbol?: string;
  indexCode?: string;
  providerCode?: string;
  attempt?: number;
  durationMs?: number;
  processed?: number;
  status?: string;
  error?: string;
  [key: string]: unknown;
}

export type IngestionLogMeta = {
  module: string;
} & Partial<Omit<IngestionLogContext, 'event' | 'module'>>;

export interface IntradayBucketMeta {
  cycleId: string;
  bucketIso: string;
  bucketDate: Date;
}

export function createIntradayBucketMeta(
  now: Date,
  timeZone: string = 'Asia/Ho_Chi_Minh',
): IntradayBucketMeta {
  const zoned = toZonedTime(now, timeZone);
  const minute = zoned.getMinutes();
  const rounded = Math.floor(minute / 15) * 15;
  zoned.setMinutes(rounded, 0, 0);

  const bucketDate = fromZonedTime(zoned, timeZone);
  const bucketIso = formatInTimeZone(bucketDate, timeZone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  return {
    cycleId: `intraday:${bucketIso}`,
    bucketIso,
    bucketDate,
  };
}

export function logPayload(context: IngestionLogContext): string {
  return JSON.stringify(context);
}

export function toLogError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}
