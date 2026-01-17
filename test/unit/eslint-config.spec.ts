import * as fs from 'fs';
import * as path from 'path';

describe('ESLint Configuration', () => {
  const projectRoot = path.join(__dirname, '..', '..');
  const eslintrcPath = path.join(projectRoot, '.eslintrc.js');
  const eslintignorePath = path.join(projectRoot, '.eslintignore');

  describe('.eslintrc.js file', () => {
    it('should exist', () => {
      expect(fs.existsSync(eslintrcPath)).toBe(true);
    });

    it('should export a valid configuration object', () => {
      // Read the file content
      const content = fs.readFileSync(eslintrcPath, 'utf-8');
      
      // Verify it's a module.exports statement
      expect(content).toContain('module.exports');
      
      // Try to require it (this will throw if invalid)
      expect(() => {
        delete require.cache[eslintrcPath];
        require(eslintrcPath);
      }).not.toThrow();
    });

    it('should have parser set to @typescript-eslint/parser', () => {
      delete require.cache[eslintrcPath];
      const config = require(eslintrcPath);
      expect(config.parser).toBe('@typescript-eslint/parser');
    });

    it('should include @typescript-eslint/eslint-plugin in plugins', () => {
      delete require.cache[eslintrcPath];
      const config = require(eslintrcPath);
      expect(config.plugins).toContain('@typescript-eslint/eslint-plugin');
    });

    it('should include plugin:@typescript-eslint/recommended in extends', () => {
      delete require.cache[eslintrcPath];
      const config = require(eslintrcPath);
      expect(config.extends).toContain('plugin:@typescript-eslint/recommended');
    });

    it('should include plugin:prettier/recommended in extends for Prettier integration', () => {
      delete require.cache[eslintrcPath];
      const config = require(eslintrcPath);
      expect(config.extends).toContain('plugin:prettier/recommended');
    });

    it('should have parserOptions configured', () => {
      delete require.cache[eslintrcPath];
      const config = require(eslintrcPath);
      expect(config.parserOptions).toBeDefined();
      expect(config.parserOptions.project).toBe('tsconfig.json');
      expect(config.parserOptions.sourceType).toBe('module');
    });

    it('should have root set to true', () => {
      delete require.cache[eslintrcPath];
      const config = require(eslintrcPath);
      expect(config.root).toBe(true);
    });

    it('should have node and jest environments enabled', () => {
      delete require.cache[eslintrcPath];
      const config = require(eslintrcPath);
      expect(config.env).toBeDefined();
      expect(config.env.node).toBe(true);
      expect(config.env.jest).toBe(true);
    });

    it('should have ignorePatterns configured', () => {
      delete require.cache[eslintrcPath];
      const config = require(eslintrcPath);
      expect(config.ignorePatterns).toBeDefined();
      expect(config.ignorePatterns).toContain('.eslintrc.js');
    });

    it('should have rules configured', () => {
      delete require.cache[eslintrcPath];
      const config = require(eslintrcPath);
      expect(config.rules).toBeDefined();
      expect(typeof config.rules).toBe('object');
    });
  });

  describe('.eslintignore file', () => {
    it('should exist', () => {
      expect(fs.existsSync(eslintignorePath)).toBe(true);
    });

    it('should contain node_modules pattern', () => {
      const content = fs.readFileSync(eslintignorePath, 'utf-8');
      expect(content).toMatch(/node_modules/);
    });

    it('should contain dist pattern', () => {
      const content = fs.readFileSync(eslintignorePath, 'utf-8');
      expect(content).toMatch(/dist/);
    });

    it('should contain build pattern', () => {
      const content = fs.readFileSync(eslintignorePath, 'utf-8');
      expect(content).toMatch(/build/);
    });

    it('should contain coverage pattern', () => {
      const content = fs.readFileSync(eslintignorePath, 'utf-8');
      expect(content).toMatch(/coverage/);
    });

    it('should contain config files pattern', () => {
      const content = fs.readFileSync(eslintignorePath, 'utf-8');
      expect(content).toMatch(/\*\.config\.js/);
    });

    it('should contain .eslintrc.js pattern', () => {
      const content = fs.readFileSync(eslintignorePath, 'utf-8');
      expect(content).toMatch(/\.eslintrc\.js/);
    });
  });
});
