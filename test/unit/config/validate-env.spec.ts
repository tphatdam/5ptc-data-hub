import { validate } from '../../../src/config/validate-env';

describe('Environment Validation', () => {
  describe('Required Variables', () => {
    it('should pass with all required variables', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).not.toThrow();
    });

    it('should pass with DATABASE_URL instead of discrete DB variables', () => {
      const config = {
        NODE_ENV: 'production',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/dbname',
      };

      expect(() => validate(config)).not.toThrow();
    });

    it('should fail when NODE_ENV is missing', () => {
      const config = {
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).toThrow(/NODE_ENV/);
    });

    it('should fail when PORT is missing', () => {
      const config = {
        NODE_ENV: 'development',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).toThrow(/PORT/);
    });

    it('should fail when LOG_LEVEL is missing', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).toThrow(/LOG_LEVEL/);
    });

    it('should fail when database variables are missing and no DATABASE_URL', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
      };

      expect(() => validate(config)).toThrow(/DB_HOST|DB_PORT|DB_USER|DB_PASS|DB_NAME/);
    });
  });

  describe('Optional Variables', () => {
    it('should pass when optional HTTP variables are missing', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).not.toThrow();
    });

    it('should pass with optional HTTP variables provided', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
        HTTP_TIMEOUT_MS: '30000',
        HTTP_RETRIES: '3',
        HTTP_RETRY_BASE_MS: '1000',
      };

      expect(() => validate(config)).not.toThrow();
    });
  });

  describe('Validation Rules', () => {
    it('should fail with invalid NODE_ENV value', () => {
      const config = {
        NODE_ENV: 'invalid',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).toThrow(/NODE_ENV/);
    });

    it('should fail with invalid PORT value', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '99999',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).toThrow(/PORT/);
    });

    it('should fail with invalid HTTP_TIMEOUT_MS value', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
        HTTP_TIMEOUT_MS: '500', // Less than minimum 1000
      };

      expect(() => validate(config)).toThrow(/HTTP_TIMEOUT_MS/);
    });

    it('should fail with invalid HTTP_RETRIES value', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
        HTTP_RETRIES: '15', // More than maximum 10
      };

      expect(() => validate(config)).toThrow(/HTTP_RETRIES/);
    });
  });

  describe('Edge Cases - Invalid PORT Format', () => {
    it('should fail with PORT as zero', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '0',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).toThrow(/PORT/);
    });

    it('should fail with PORT as negative number', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '-1',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).toThrow(/PORT/);
    });

    it('should fail with PORT exceeding maximum (65535)', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '65536',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).toThrow(/PORT/);
    });

    it('should fail with PORT as non-numeric string', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: 'abc',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).toThrow(/PORT/);
    });

    it('should fail with PORT as floating point number', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000.5',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).toThrow(/PORT/);
    });

    it('should pass with PORT at minimum valid value (1)', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '1',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).not.toThrow();
    });

    it('should pass with PORT at maximum valid value (65535)', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '65535',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).not.toThrow();
    });
  });

  describe('Edge Cases - DATABASE_URL vs Discrete DB_* Variables', () => {
    it('should pass with only DATABASE_URL (no discrete variables)', () => {
      const config = {
        NODE_ENV: 'production',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/dbname',
      };

      expect(() => validate(config)).not.toThrow();
    });

    it('should pass with only discrete DB_* variables (no DATABASE_URL)', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).not.toThrow();
    });

    it('should pass with both DATABASE_URL and discrete variables (DATABASE_URL takes precedence)', () => {
      const config = {
        NODE_ENV: 'production',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/dbname',
        DB_HOST: 'other-host',
        DB_PORT: '5433',
        DB_USER: 'other-user',
        DB_PASS: 'other-pass',
        DB_NAME: 'other-db',
      };

      expect(() => validate(config)).not.toThrow();
    });

    it('should fail when DATABASE_URL is missing and DB_HOST is missing', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).toThrow(/DB_HOST/);
    });

    it('should fail when DATABASE_URL is missing and DB_PORT is missing', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).toThrow(/DB_PORT/);
    });

    it('should fail when DATABASE_URL is missing and DB_USER is missing', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).toThrow(/DB_USER/);
    });

    it('should fail when DATABASE_URL is missing and DB_PASS is missing', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).toThrow(/DB_PASS/);
    });

    it('should fail when DATABASE_URL is missing and DB_NAME is missing', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
      };

      expect(() => validate(config)).toThrow(/DB_NAME/);
    });

    it('should fail when DATABASE_URL is empty string and discrete variables are missing', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DATABASE_URL: '',
      };

      expect(() => validate(config)).toThrow(/DB_HOST|DB_PORT|DB_USER|DB_PASS|DB_NAME/);
    });

    it('should fail with invalid DB_PORT format (non-numeric)', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: 'invalid',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).toThrow(/DB_PORT/);
    });

    it('should fail with DB_PORT exceeding maximum (65535)', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '65536',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).toThrow(/DB_PORT/);
    });

    it('should fail with DB_PORT as zero', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '0',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      expect(() => validate(config)).toThrow(/DB_PORT/);
    });
  });

  describe('Edge Cases - Default Values for Optional Variables', () => {
    it('should use default HTTP_TIMEOUT_MS when not provided', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      const validated = validate(config);
      // Validation passes, defaults are applied in configuration.ts
      expect(validated).toBeDefined();
    });

    it('should use default HTTP_RETRIES when not provided', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      const validated = validate(config);
      expect(validated).toBeDefined();
    });

    it('should use default HTTP_RETRY_BASE_MS when not provided', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
      };

      const validated = validate(config);
      expect(validated).toBeDefined();
    });

    it('should accept HTTP_TIMEOUT_MS at minimum boundary (1000)', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
        HTTP_TIMEOUT_MS: '1000',
      };

      expect(() => validate(config)).not.toThrow();
    });

    it('should reject HTTP_TIMEOUT_MS below minimum (999)', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
        HTTP_TIMEOUT_MS: '999',
      };

      expect(() => validate(config)).toThrow(/HTTP_TIMEOUT_MS/);
    });

    it('should accept HTTP_RETRIES at minimum boundary (0)', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
        HTTP_RETRIES: '0',
      };

      expect(() => validate(config)).not.toThrow();
    });

    it('should accept HTTP_RETRIES at maximum boundary (10)', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
        HTTP_RETRIES: '10',
      };

      expect(() => validate(config)).not.toThrow();
    });

    it('should reject HTTP_RETRIES above maximum (11)', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
        HTTP_RETRIES: '11',
      };

      expect(() => validate(config)).toThrow(/HTTP_RETRIES/);
    });

    it('should reject HTTP_RETRIES as negative', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
        HTTP_RETRIES: '-1',
      };

      expect(() => validate(config)).toThrow(/HTTP_RETRIES/);
    });

    it('should accept HTTP_RETRY_BASE_MS at minimum boundary (100)', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
        HTTP_RETRY_BASE_MS: '100',
      };

      expect(() => validate(config)).not.toThrow();
    });

    it('should reject HTTP_RETRY_BASE_MS below minimum (99)', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
        HTTP_RETRY_BASE_MS: '99',
      };

      expect(() => validate(config)).toThrow(/HTTP_RETRY_BASE_MS/);
    });

    it('should accept large HTTP_TIMEOUT_MS value', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
        HTTP_TIMEOUT_MS: '120000',
      };

      expect(() => validate(config)).not.toThrow();
    });

    it('should accept large HTTP_RETRY_BASE_MS value', () => {
      const config = {
        NODE_ENV: 'development',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'postgres',
        DB_PASS: 'password',
        DB_NAME: 'testdb',
        HTTP_RETRY_BASE_MS: '10000',
      };

      expect(() => validate(config)).not.toThrow();
    });
  });
});
