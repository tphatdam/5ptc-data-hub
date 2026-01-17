import * as fs from 'fs';
import * as path from 'path';

describe('Prettier Configuration', () => {
  const projectRoot = path.join(__dirname, '..', '..');
  const prettierrcPath = path.join(projectRoot, '.prettierrc');
  const prettierignorePath = path.join(projectRoot, '.prettierignore');

  describe('.prettierrc file', () => {
    it('should exist', () => {
      expect(fs.existsSync(prettierrcPath)).toBe(true);
    });

    it('should be valid JSON', () => {
      const content = fs.readFileSync(prettierrcPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should contain all required settings', () => {
      const content = fs.readFileSync(prettierrcPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config).toHaveProperty('singleQuote');
      expect(config).toHaveProperty('trailingComma');
      expect(config).toHaveProperty('printWidth');
      expect(config).toHaveProperty('tabWidth');
      expect(config).toHaveProperty('semi');
      expect(config).toHaveProperty('arrowParens');
      expect(config).toHaveProperty('endOfLine');
    });

    it('should have singleQuote set to true', () => {
      const content = fs.readFileSync(prettierrcPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.singleQuote).toBe(true);
    });

    it('should have trailingComma set to "all"', () => {
      const content = fs.readFileSync(prettierrcPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.trailingComma).toBe('all');
    });

    it('should have printWidth set to 100', () => {
      const content = fs.readFileSync(prettierrcPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.printWidth).toBe(100);
    });

    it('should have tabWidth set to 2', () => {
      const content = fs.readFileSync(prettierrcPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.tabWidth).toBe(2);
    });

    it('should have semi set to true', () => {
      const content = fs.readFileSync(prettierrcPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.semi).toBe(true);
    });

    it('should have arrowParens set to "always"', () => {
      const content = fs.readFileSync(prettierrcPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.arrowParens).toBe('always');
    });

    it('should have endOfLine set to "lf"', () => {
      const content = fs.readFileSync(prettierrcPath, 'utf-8');
      const config = JSON.parse(content);
      expect(config.endOfLine).toBe('lf');
    });
  });

  describe('.prettierignore file', () => {
    it('should exist', () => {
      expect(fs.existsSync(prettierignorePath)).toBe(true);
    });

    it('should contain node_modules pattern', () => {
      const content = fs.readFileSync(prettierignorePath, 'utf-8');
      expect(content).toMatch(/node_modules/);
    });

    it('should contain dist pattern', () => {
      const content = fs.readFileSync(prettierignorePath, 'utf-8');
      expect(content).toMatch(/dist/);
    });

    it('should contain build pattern', () => {
      const content = fs.readFileSync(prettierignorePath, 'utf-8');
      expect(content).toMatch(/build/);
    });

    it('should contain coverage pattern', () => {
      const content = fs.readFileSync(prettierignorePath, 'utf-8');
      expect(content).toMatch(/coverage/);
    });

    it('should contain package-lock.json pattern', () => {
      const content = fs.readFileSync(prettierignorePath, 'utf-8');
      expect(content).toMatch(/package-lock\.json/);
    });

    it('should contain generated files patterns', () => {
      const content = fs.readFileSync(prettierignorePath, 'utf-8');
      expect(content).toMatch(/\*\.min\.js/);
      expect(content).toMatch(/\*\.min\.css/);
    });

    it('should contain log files pattern', () => {
      const content = fs.readFileSync(prettierignorePath, 'utf-8');
      expect(content).toMatch(/\*\.log/);
    });
  });
});
