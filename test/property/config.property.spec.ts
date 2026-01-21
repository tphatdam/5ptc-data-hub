import * as fc from 'fast-check';
import { validate } from '../../src/config/validate-env';

describe('Configuration Validation - Property Tests', () => {
  describe('Property 1: Missing required environment variables cause startup failure', () => {
    /**
     * **Validates: Requirements 2.4, 2.5**
     * 
     * For any required environment variable (NODE_ENV, PORT, DATABASE_URL or 
     * DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME, LOG_LEVEL), when it is missing, 
     * the system should fail to start with an error message containing the variable name.
     */
    it('should fail when NODE_ENV is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
            DB_HOST: fc.string({ minLength: 1 }),
            DB_PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            DB_USER: fc.string({ minLength: 1 }),
            DB_PASS: fc.string({ minLength: 1 }),
            DB_NAME: fc.string({ minLength: 1 }),
          }),
          async (config) => {
            // NODE_ENV is intentionally missing
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
            DB_HOST: fc.string({ minLength: 1 }),
            DB_PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            DB_USER: fc.string({ minLength: 1 }),
            DB_PASS: fc.string({ minLength: 1 }),
            DB_NAME: fc.string({ minLength: 1 }),
          }),
          async (config) => {
            // PORT is intentionally missing
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
            DB_HOST: fc.string({ minLength: 1 }),
            DB_PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            DB_USER: fc.string({ minLength: 1 }),
            DB_PASS: fc.string({ minLength: 1 }),
            DB_NAME: fc.string({ minLength: 1 }),
          }),
          async (config) => {
            // LOG_LEVEL is intentionally missing
            expect(() => validate(config)).toThrow(/LOG_LEVEL/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fail when database variables are missing and no DATABASE_URL', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
          }),
          async (config) => {
            // No DATABASE_URL and no discrete DB variables
            expect(() => validate(config)).toThrow(/DB_HOST|DB_PORT|DB_USER|DB_PASS|DB_NAME/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fail when only some database variables are provided without DATABASE_URL', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
          }),
          fc.subarray(
            ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME'],
            { minLength: 1, maxLength: 4 } // At least 1, but not all 5
          ),
          async (baseConfig, missingVars) => {
            // Add only some DB variables (not all)
            const config: any = { ...baseConfig };
            const allDbVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME'];
            const varsToAdd = allDbVars.filter(v => !missingVars.includes(v));
            
            varsToAdd.forEach(varName => {
              if (varName === 'DB_PORT') {
                config[varName] = '5432';
              } else {
                config[varName] = 'test-value';
              }
            });

            // Should fail because not all DB variables are present
            expect(() => validate(config)).toThrow();
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
            DB_HOST: fc.string({ minLength: 1 }),
            DB_PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            DB_USER: fc.string({ minLength: 1 }),
            DB_PASS: fc.string({ minLength: 1 }),
            DB_NAME: fc.string({ minLength: 1 }),
          }),
          async (config) => {
            // Optional HTTP variables are intentionally missing
            expect(() => validate(config)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should pass when all required variables are present with DATABASE_URL and optional variables are missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
            DATABASE_URL: fc.string({ minLength: 10 }).map(url => `postgresql://user:pass@localhost:5432/${url}`),
          }),
          async (config) => {
            // Optional HTTP variables are intentionally missing
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
            DB_HOST: fc.string({ minLength: 1 }),
            DB_PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            DB_USER: fc.string({ minLength: 1 }),
            DB_PASS: fc.string({ minLength: 1 }),
            DB_NAME: fc.string({ minLength: 1 }),
            HTTP_RETRIES: fc.integer({ min: 0, max: 10 }).map(String),
            HTTP_RETRY_BASE_MS: fc.integer({ min: 100, max: 10000 }).map(String),
          }),
          async (config) => {
            // HTTP_TIMEOUT_MS is intentionally missing
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
            DB_HOST: fc.string({ minLength: 1 }),
            DB_PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            DB_USER: fc.string({ minLength: 1 }),
            DB_PASS: fc.string({ minLength: 1 }),
            DB_NAME: fc.string({ minLength: 1 }),
            HTTP_TIMEOUT_MS: fc.integer({ min: 1000, max: 120000 }).map(String),
            HTTP_RETRY_BASE_MS: fc.integer({ min: 100, max: 10000 }).map(String),
          }),
          async (config) => {
            // HTTP_RETRIES is intentionally missing
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
            DB_HOST: fc.string({ minLength: 1 }),
            DB_PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            DB_USER: fc.string({ minLength: 1 }),
            DB_PASS: fc.string({ minLength: 1 }),
            DB_NAME: fc.string({ minLength: 1 }),
            HTTP_TIMEOUT_MS: fc.integer({ min: 1000, max: 120000 }).map(String),
            HTTP_RETRIES: fc.integer({ min: 0, max: 10 }).map(String),
          }),
          async (config) => {
            // HTTP_RETRY_BASE_MS is intentionally missing
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
            DB_HOST: fc.string({ minLength: 1 }),
            DB_PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            DB_USER: fc.string({ minLength: 1 }),
            DB_PASS: fc.string({ minLength: 1 }),
            DB_NAME: fc.string({ minLength: 1 }),
            HTTP_TIMEOUT_MS: fc.integer({ min: 1000, max: 120000 }).map(String),
            HTTP_RETRIES: fc.integer({ min: 0, max: 10 }).map(String),
            HTTP_RETRY_BASE_MS: fc.integer({ min: 100, max: 10000 }).map(String),
          }),
          async (config) => {
            // All variables present with valid values
            expect(() => validate(config)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Database connection configuration flexibility', () => {
    /**
     * **Validates: Requirements 3.2**
     * 
     * For any valid database configuration (either DATABASE_URL or discrete DB_* variables), 
     * the system should successfully connect to the database.
     */
    it('should accept valid DATABASE_URL configuration', async () => {
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
          }),
          async (config) => {
            // Should pass validation with DATABASE_URL
            expect(() => validate(config)).not.toThrow();
            
            // Verify the validated config contains DATABASE_URL
            const validated = validate(config);
            expect(validated.DATABASE_URL).toBeDefined();
            expect(validated.DATABASE_URL).toContain('postgresql://');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid discrete database variables configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
            DB_HOST: fc.constantFrom('localhost', '127.0.0.1', 'postgres', 'db.example.com'),
            DB_PORT: fc.integer({ min: 1024, max: 65535 }).map(String),
            DB_USER: fc.string({ minLength: 1, maxLength: 50 }),
            DB_PASS: fc.string({ minLength: 1, maxLength: 50 }), // Password must be non-empty per validation rules
            DB_NAME: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          async (config) => {
            // Should pass validation with discrete DB variables
            expect(() => validate(config)).not.toThrow();
            
            // Verify the validated config contains all DB variables
            const validated = validate(config);
            expect(validated.DB_HOST).toBeDefined();
            expect(validated.DB_PORT).toBeDefined();
            expect(validated.DB_USER).toBeDefined();
            expect(validated.DB_PASS).toBeDefined();
            expect(validated.DB_NAME).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prefer DATABASE_URL when both DATABASE_URL and discrete variables are provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
            DATABASE_URL: fc.record({
              user: fc.string({ minLength: 1, maxLength: 20 }),
              pass: fc.string({ minLength: 1, maxLength: 20 }),
              host: fc.constantFrom('localhost', '127.0.0.1'),
              port: fc.integer({ min: 1024, max: 65535 }),
              dbname: fc.string({ minLength: 1, maxLength: 20 }),
            }).map(({ user, pass, host, port, dbname }) => 
              `postgresql://${user}:${pass}@${host}:${port}/${dbname}`
            ),
            // Also provide discrete variables (should be ignored)
            DB_HOST: fc.string({ minLength: 1 }),
            DB_PORT: fc.integer({ min: 1024, max: 65535 }).map(String),
            DB_USER: fc.string({ minLength: 1 }),
            DB_PASS: fc.string({ minLength: 1 }),
            DB_NAME: fc.string({ minLength: 1 }),
          }),
          async (config) => {
            // Should pass validation - DATABASE_URL takes precedence
            expect(() => validate(config)).not.toThrow();
            
            // Verify DATABASE_URL is present
            const validated = validate(config);
            expect(validated.DATABASE_URL).toBeDefined();
            expect(validated.DATABASE_URL).toContain('postgresql://');
            
            // Discrete variables should also be present but not required
            // (validation passes because DATABASE_URL is present)
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
          }),
          fc.constantFrom(
            // Various valid PostgreSQL connection string formats
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
            
            // Should pass validation with various connection string formats
            expect(() => validate(config)).not.toThrow();
            
            const validated = validate(config);
            expect(validated.DATABASE_URL).toBe(databaseUrl);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases in discrete database configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            NODE_ENV: fc.constantFrom('development', 'production', 'test'),
            PORT: fc.integer({ min: 1, max: 65535 }).map(String),
            LOG_LEVEL: fc.constantFrom('debug', 'info', 'warn', 'error'),
            DB_HOST: fc.constantFrom(
              'localhost',
              '127.0.0.1',
              '::1', // IPv6 localhost
              'postgres',
              'db',
              'database.internal',
            ),
            DB_PORT: fc.constantFrom(5432, 5433, 5434, 15432).map(String),
            DB_USER: fc.constantFrom('postgres', 'admin', 'root', 'user', 'vnstock'),
            DB_PASS: fc.constantFrom('password', 'secret123', 'p@ssw0rd!', 'test'),
            DB_NAME: fc.constantFrom('vnstock_hub', 'postgres', 'test_db', 'production'),
          }),
          async (config) => {
            // Should pass validation with various realistic values
            expect(() => validate(config)).not.toThrow();
            
            const validated = validate(config);
            expect(validated.DB_HOST).toBe(config.DB_HOST);
            expect(validated.DB_PORT).toBe(parseInt(config.DB_PORT, 10));
            expect(validated.DB_USER).toBe(config.DB_USER);
            expect(validated.DB_PASS).toBe(config.DB_PASS);
            expect(validated.DB_NAME).toBe(config.DB_NAME);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
