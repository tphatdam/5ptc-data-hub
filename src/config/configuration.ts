export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  },
  http: {
    timeoutMs: parseInt(process.env.HTTP_TIMEOUT_MS || '30000', 10),
    retries: parseInt(process.env.HTTP_RETRIES || '5', 10),
    retryBaseMs: parseInt(process.env.HTTP_RETRY_BASE_MS || '1000', 10),
  },
  schedule: {
    intradayCron: process.env.INTRADAY_CRON || '*/15 * * * *',
    dailyEodCron: process.env.DAILY_EOD_CRON || '5 18 * * *',
    quoteHourlyCron: process.env.QUOTE_HOURLY_CRON || '0 * * * *',
    dailyCompanyCron: process.env.DAILY_COMPANY_CRON || '0 18 * * *',
    timezone: process.env.SCHEDULE_TIMEZONE || 'Asia/Ho_Chi_Minh',
  },
  simplize: {
    baseUrl: process.env.SIMPLIZE_BASE_URL || 'https://api2.simplize.vn',
    authToken: process.env.SIMPLIZE_AUTH_TOKEN,
    reportTypes: (process.env.SIMPLIZE_REPORT_TYPES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    newsTypeIds: (process.env.SIMPLIZE_NEWS_TYPE_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
});
