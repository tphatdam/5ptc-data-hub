import * as fc from 'fast-check';
import { validate } from '../../src/config/validate-env';

describe('Configuration Validation - Property Tests', () => {
  describe('Property 1: Missing required environment variables cause startup failure', () => {
    /**
     * **Validates: Requirements 2.4, 2.5**
     *
     * For any required environment variable (NODE_ENV, PORT, LOG_LEVEL, DATABASE_URL, REDIS_URL),
     * when it is missing, the system should fail to start with an error message containing the variable name.
     */
    it('should fail when NODE_ENV is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
            DATABASE_URL: fc.string({ minLength: 10 }).map((s) => `postgresql://${s}`),
            REDIS_URL: fc.constantFrom('redis://localhost:6379', 'redis://127.0.0.1:6379'),
          }),
          async (config) => {
            expect(() => validate(config)).toThrow(/NODE_ENV/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fail when PORT is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
            DATABASE_URL: fc.string({ minLength: 10 }).map((s) => `postgresql://${s}`),
            REDIS_URL: fc.constantFrom('redis://localhost:6379', 'redis://127.0.0.1:6379'),
          }),
          async (config) => {
            expect(() => validate(config)).toThrow(/PORT/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fail when LOG_LEVEL is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            DATABASE_URL: fc.string({ minLength: 10 }).map((s) => `postgresql://${s}`),
            REDIS_URL: fc.constantFrom('redis://localhost:6379', 'redis://127.0.0.1:6379'),
          }),
          async (config) => {
            expect(() => validate(config)).toThrow(/LOG_LEVEL/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fail when DATABASE_URL is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
            REDIS_URL: fc.constantFrom('redis://localhost:6379', 'redis://127.0.0.1:6379'),
          }),
          async (config) => {
            expect(() => validate(config)).toThrow(/DATABASE_URL/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fail when REDIS_URL is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
            DATABASE_URL: fc.string({ minLength: 10 }).map((s) => `postgresql://${s}`),
          }),
          async (config) => {
            expect(() => validate(config)).toThrow(/REDIS_URL/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Optional environment variables allow startup', () => {
    /**
     * **Validates: Requirements 2.4, 2.5**
     *
     * For any optional environment variable (HTTP_TIMEOUT_MS, HTTP_RETRIES, HTTP_RETRY_BASE_MS),
     * when it is missing, the system should start successfully with default values.
     */
    it('should pass when all required variables are present and optional variables are missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
            DATABASE_URL: fc.string({ minLength: 10 }).map((s) => `postgresql://user:pass@localhost:5432/${s}`),
            REDIS_URL: fc.constantFrom('redis://localhost:6379', 'redis://127.0.0.1:6379'),
          }),
          async (config) => {
            expect(() => validate(config)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should pass when optional HTTP_TIMEOUT_MS is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
            DATABASE_URL: fc.string({ minLength: 10 }).map((s) => `postgresql://user:pass@localhost:5432/${s}`),
            REDIS_URL: fc.constantFrom('redis://localhost:6379'),
            HTTP_RETRIES: fc.integer({ min: 0, max: 10 }).map(String),
            HTTP_RETRY_BASE_MS: fc.integer({ min: 100, max: 10000 }).map(String),
          }),
          async (config) => {
            expect(() => validate(config)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should pass when optional HTTP_RETRIES is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
            DATABASE_URL: fc.string({ minLength: 10 }).map((s) => `postgresql://user:pass@localhost:5432/${s}`),
            REDIS_URL: fc.constantFrom('redis://localhost:6379'),
            HTTP_TIMEOUT_MS: fc.integer({ min: 1000, max: 120000 }).map(String),
            HTTP_RETRY_BASE_MS: fc.integer({ min: 100, max: 10000 }).map(String),
          }),
          async (config) => {
            expect(() => validate(config)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should pass when optional HTTP_RETRY_BASE_MS is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
            DATABASE_URL: fc.string({ minLength: 10 }).map((s) => `postgresql://user:pass@localhost:5432/${s}`),
            REDIS_URL: fc.constantFrom('redis://localhost:6379'),
            HTTP_TIMEOUT_MS: fc.integer({ min: 1000, max: 120000 }).map(String),
            HTTP_RETRIES: fc.integer({ min: 0, max: 10 }).map(String),
          }),
          async (config) => {
            expect(() => validate(config)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should pass when all optional HTTP variables are present with valid values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
            DATABASE_URL: fc.string({ minLength: 10 }).map((s) => `postgresql://user:pass@localhost:5432/${s}`),
            REDIS_URL: fc.constantFrom('redis://localhost:6379'),
            HTTP_TIMEOUT_MS: fc.integer({ min: 1000, max: 120000 }).map(String),
            HTTP_RETRIES: fc.integer({ min: 0, max: 10 }).map(String),
            HTTP_RETRY_BASE_MS: fc.integer({ min: 100, max: 10000 }).map(String),
          }),
          async (config) => {
            expect(() => validate(config)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Database and Redis URL configuration', () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * For any valid DATABASE_URL and REDIS_URL, the system should pass validation.
     */
    it('should accept valid DATABASE_URL and REDIS_URL configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
            DATABASE_URL: fc.record({
              user: fc.string({ minLength: 1, maxLength: 20 }),
              pass: fc.string({ minLength: 1, maxLength: 20 }),
              host: fc.constantFrom('localhost', '127.0.0.1', 'db.example.com'),
              port: fc.integer({ min: 1024, max: 65535 }),
              dbname: fc.string({ minLength: 1, maxLength: 20 }),
            }).map(({ user, pass, host, port, dbname }) =>
              `postgresql://${user}:${pass}@${host}:${port}/${dbname}`
            ),
            REDIS_URL: fc.constantFrom('redis://localhost:6379', 'redis://127.0.0.1:6379', 'rediss://user:pass@redis.example.com:6379'),
          }),
          async (config) => {
            expect(() => validate(config)).not.toThrow();
            const validated = validate(config);
            expect(validated.DATABASE_URL).toBeDefined();
            expect(validated.DATABASE_URL).toContain('postgresql://');
            expect(validated.REDIS_URL).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle various valid PostgreSQL connection string formats', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
            REDIS_URL: fc.constant('redis://localhost:6379'),
          }),
          fc.constantFrom(
            'postgresql://user:pass@localhost:5432/dbname',
            'postgresql://user@localhost/dbname',
            'postgresql://localhost/dbname',
            'postgres://user:pass@localhost:5432/dbname',
            'postgresql://user:pass@127.0.0.1:5432/dbname',
            'postgresql://user:pass@db.example.com:5432/dbname',
            'postgresql://user:pass@localhost:5432/dbname?sslmode=require',
            'postgresql://user:pass@localhost/dbname?schema=public',
          ),
          async (baseConfig, databaseUrl) => {
            const config = { ...baseConfig, DATABASE_URL: databaseUrl };
            expect(() => validate(config)).not.toThrow();
            const validated = validate(config);
            expect(validated.DATABASE_URL).toBe(databaseUrl);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle various valid Redis URL formats', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
            DATABASE_URL: fc.constant('postgresql://user:pass@localhost:5432/db'),
          }),
          fc.constantFrom(
            'redis://localhost:6379',
            'redis://127.0.0.1:6379',
            'redis://:password@host:6379',
            'rediss://host:6379',
          ),
          async (baseConfig, redisUrl) => {
            const config = { ...baseConfig, REDIS_URL: redisUrl };
            expect(() => validate(config)).not.toThrow();
            const validated = validate(config);
            expect(validated.REDIS_URL).toBe(redisUrl);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
