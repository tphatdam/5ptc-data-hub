import { validate } from '../../../src/config/validate-env';

const baseRequired = {
  NODE_ENV: 'development',
  PORT: '3000',
  LOG_LEVEL: 'info',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
  REDIS_URL: 'redis://localhost:6379',
};

describe('Environment Validation', () => {
  describe('Required Variables', () => {
    it('should pass with all required variables', () => {
      expect(() => validate({ ...baseRequired })).not.toThrow();
    });

    it('should pass with DATABASE_URL and REDIS_URL', () => {
      const config = {
        NODE_ENV: 'production',
        PORT: '3000',
        LOG_LEVEL: 'info',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/dbname',
        REDIS_URL: 'redis://localhost:6379',
      };
      expect(() => validate(config)).not.toThrow();
    });

    it('should fail when NODE_ENV is missing', () => {
      const { NODE_ENV: _, ...config } = baseRequired;
      expect(() => validate(config)).toThrow(/NODE_ENV/);
    });

    it('should fail when PORT is missing', () => {
      const { PORT: _, ...config } = baseRequired;
      expect(() => validate(config)).toThrow(/PORT/);
    });

    it('should fail when LOG_LEVEL is missing', () => {
      const { LOG_LEVEL: _, ...config } = baseRequired;
      expect(() => validate(config)).toThrow(/LOG_LEVEL/);
    });

    it('should fail when DATABASE_URL is missing', () => {
      const { DATABASE_URL: _, ...config } = baseRequired;
      expect(() => validate(config)).toThrow(/DATABASE_URL/);
    });

    it('should fail when REDIS_URL is missing', () => {
      const { REDIS_URL: _, ...config } = baseRequired;
      expect(() => validate(config)).toThrow(/REDIS_URL/);
    });
  });

  describe('Optional Variables', () => {
    it('should pass when optional HTTP variables are missing', () => {
      expect(() => validate({ ...baseRequired })).not.toThrow();
    });

    it('should pass with optional HTTP variables provided', () => {
      const config = {
        ...baseRequired,
        HTTP_TIMEOUT_MS: '30000',
        HTTP_RETRIES: '3',
        HTTP_RETRY_BASE_MS: '1000',
      };
      expect(() => validate(config)).not.toThrow();
    });
  });

  describe('Validation Rules', () => {
    it('should fail with invalid NODE_ENV value', () => {
      const config = { ...baseRequired, NODE_ENV: 'invalid' };
      expect(() => validate(config)).toThrow(/NODE_ENV/);
    });

    it('should fail with invalid PORT value', () => {
      const config = { ...baseRequired, PORT: '99999' };
      expect(() => validate(config)).toThrow(/PORT/);
    });

    it('should fail with invalid HTTP_TIMEOUT_MS value', () => {
      const config = { ...baseRequired, HTTP_TIMEOUT_MS: '500' };
      expect(() => validate(config)).toThrow(/HTTP_TIMEOUT_MS/);
    });

    it('should fail with invalid HTTP_RETRIES value', () => {
      const config = { ...baseRequired, HTTP_RETRIES: '15' };
      expect(() => validate(config)).toThrow(/HTTP_RETRIES/);
    });
  });

  describe('Edge Cases - Invalid PORT Format', () => {
    it('should fail with PORT as zero', () => {
      expect(() => validate({ ...baseRequired, PORT: '0' })).toThrow(/PORT/);
    });

    it('should fail with PORT as negative number', () => {
      expect(() => validate({ ...baseRequired, PORT: '-1' })).toThrow(/PORT/);
    });

    it('should fail with PORT exceeding maximum (65535)', () => {
      expect(() => validate({ ...baseRequired, PORT: '65536' })).toThrow(/PORT/);
    });

    it('should fail with PORT as non-numeric string', () => {
      expect(() => validate({ ...baseRequired, PORT: 'abc' })).toThrow(/PORT/);
    });

    it('should fail with PORT as floating point number', () => {
      expect(() => validate({ ...baseRequired, PORT: '3000.5' })).toThrow(/PORT/);
    });

    it('should pass with PORT at minimum valid value (1)', () => {
      expect(() => validate({ ...baseRequired, PORT: '1' })).not.toThrow();
    });

    it('should pass with PORT at maximum valid value (65535)', () => {
      expect(() => validate({ ...baseRequired, PORT: '65535' })).not.toThrow();
    });
  });

  describe('Edge Cases - DATABASE_URL and REDIS_URL', () => {
    it('should pass with DATABASE_URL and REDIS_URL', () => {
      const config = {
        ...baseRequired,
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/dbname',
      };
      expect(() => validate(config)).not.toThrow();
    });

    it('should fail when DATABASE_URL is empty string', () => {
      const config = { ...baseRequired, DATABASE_URL: '' };
      expect(() => validate(config)).toThrow(/DATABASE_URL/);
    });

    it('should fail when REDIS_URL is empty string', () => {
      const config = { ...baseRequired, REDIS_URL: '' };
      expect(() => validate(config)).toThrow(/REDIS_URL/);
    });
  });

  describe('Edge Cases - Default Values for Optional Variables', () => {
    it('should use default HTTP_TIMEOUT_MS when not provided', () => {
      const validated = validate({ ...baseRequired });
      expect(validated).toBeDefined();
    });

    it('should use default HTTP_RETRIES when not provided', () => {
      const validated = validate({ ...baseRequired });
      expect(validated).toBeDefined();
    });

    it('should use default HTTP_RETRY_BASE_MS when not provided', () => {
      const validated = validate({ ...baseRequired });
      expect(validated).toBeDefined();
    });

    it('should accept HTTP_TIMEOUT_MS at minimum boundary (1000)', () => {
      expect(() => validate({ ...baseRequired, HTTP_TIMEOUT_MS: '1000' })).not.toThrow();
    });

    it('should reject HTTP_TIMEOUT_MS below minimum (999)', () => {
      expect(() => validate({ ...baseRequired, HTTP_TIMEOUT_MS: '999' })).toThrow(/HTTP_TIMEOUT_MS/);
    });

    it('should accept HTTP_RETRIES at minimum boundary (0)', () => {
      expect(() => validate({ ...baseRequired, HTTP_RETRIES: '0' })).not.toThrow();
    });

    it('should accept HTTP_RETRIES at maximum boundary (10)', () => {
      expect(() => validate({ ...baseRequired, HTTP_RETRIES: '10' })).not.toThrow();
    });

    it('should reject HTTP_RETRIES above maximum (11)', () => {
      expect(() => validate({ ...baseRequired, HTTP_RETRIES: '11' })).toThrow(/HTTP_RETRIES/);
    });

    it('should reject HTTP_RETRIES as negative', () => {
      expect(() => validate({ ...baseRequired, HTTP_RETRIES: '-1' })).toThrow(/HTTP_RETRIES/);
    });

    it('should accept HTTP_RETRY_BASE_MS at minimum boundary (100)', () => {
      expect(() => validate({ ...baseRequired, HTTP_RETRY_BASE_MS: '100' })).not.toThrow();
    });

    it('should reject HTTP_RETRY_BASE_MS below minimum (99)', () => {
      expect(() => validate({ ...baseRequired, HTTP_RETRY_BASE_MS: '99' })).toThrow(/HTTP_RETRY_BASE_MS/);
    });

    it('should accept large HTTP_TIMEOUT_MS value', () => {
      expect(() => validate({ ...baseRequired, HTTP_TIMEOUT_MS: '120000' })).not.toThrow();
    });

    it('should accept large HTTP_RETRY_BASE_MS value', () => {
      expect(() => validate({ ...baseRequired, HTTP_RETRY_BASE_MS: '10000' })).not.toThrow();
    });
  });
});
