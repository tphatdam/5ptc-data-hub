export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL,
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
  dataHub: {
    providerFallbackChain:
      process.env.DATA_HUB_PROVIDER_FALLBACK_CHAIN || 'TCBS_API,SSTOCK_API,SIMPLIZE_API',
    sstockBaseUrl: process.env.SSTOCK_BASE_URL || 'https://api-feature.sstock.vn',
    sstockCookie: process.env.SSTOCK_COOKIE,
  },
  unified: {
    newsSourceMode: (process.env.UNIFIED_NEWS_SOURCE_MODE || 'daily-company').toLowerCase(),
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
  seed: {
    runOnStart: process.env.SEED_ON_STARTUP !== 'false',
  },
  // Agent API (api/agent/*): DB-first + live fallback
  agentData: {
    timeoutMs: parseInt(process.env.AGENT_DATA_TIMEOUT_MS || '15000', 10),
    liveFallbackEnabled: process.env.AGENT_DATA_LIVE_FALLBACK_ENABLED !== 'false',
  },
  // API compatibility / frontend proxy
  internalApiKey: process.env.INTERNAL_API_KEY,
  vnStock: {
    apiUrl: process.env.VN_STOCK_API_URL,
  },
  vietstock: {
    base: process.env.VIETSTOCK_BASE,
    cookie: process.env.VIETSTOCK_COOKIE,
  },
  fireant: {
    baseUrl: process.env.FIREANT_BASE_URL,
    token: process.env.FIREANT_TOKEN,
  },
  aiCrawler: {
    apiUrl: process.env.AI_CRAWLER_API_URL,
  },
  vndirect: {
    baseUrl: process.env.VNDIRECT_BASE_URL,
  },
  payment: {
    amount: process.env.PAYMENT_AMOUNT,
  },
});
