import configuration from '../../../src/config/configuration';

describe('Configuration Loader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should load configuration with default values', () => {
    process.env.NODE_ENV = 'development';
    process.env.PORT = '3000';
    process.env.LOG_LEVEL = 'info';

    const config = configuration();

    expect(config.app.nodeEnv).toBe('development');
    expect(config.app.port).toBe(3000);
    expect(config.app.logLevel).toBe('info');
  });

  it('should load database configuration from DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/dbname';

    const config = configuration();

    expect(config.database.url).toBe('postgresql://user:pass@localhost:5432/dbname');
  });

  it('should load redis configuration from REDIS_URL', () => {
    process.env.REDIS_URL = 'redis://localhost:6379';

    const config = configuration();

    expect(config.redis.url).toBe('redis://localhost:6379');
  });

  it('should load HTTP configuration with defaults', () => {
    const config = configuration();

    expect(config.http.timeoutMs).toBe(30000);
    expect(config.http.retries).toBe(5);
    expect(config.http.retryBaseMs).toBe(1000);
  });

  it('should load HTTP configuration from environment variables', () => {
    process.env.HTTP_TIMEOUT_MS = '60000';
    process.env.HTTP_RETRIES = '5';
    process.env.HTTP_RETRY_BASE_MS = '2000';

    const config = configuration();

    expect(config.http.timeoutMs).toBe(60000);
    expect(config.http.retries).toBe(5);
    expect(config.http.retryBaseMs).toBe(2000);
  });

  it('should use default values when environment variables are not set', () => {
    delete process.env.PORT;
    delete process.env.LOG_LEVEL;
    delete process.env.HTTP_TIMEOUT_MS;

    const config = configuration();

    expect(config.app.port).toBe(3000);
    expect(config.app.logLevel).toBe('info');
    expect(config.http.timeoutMs).toBe(30000);
  });
});
