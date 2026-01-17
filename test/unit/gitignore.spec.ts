import * as fs from 'fs';
import * as path from 'path';

describe('Git Ignore Configuration', () => {
  const projectRoot = path.join(__dirname, '..', '..');
  const gitignorePath = path.join(projectRoot, '.gitignore');

  describe('.gitignore file', () => {
    it('should exist', () => {
      expect(fs.existsSync(gitignorePath)).toBe(true);
    });

    it('should contain node_modules pattern', () => {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toMatch(/node_modules/);
    });

    it('should contain dist pattern', () => {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toMatch(/dist/);
    });

    it('should contain build pattern', () => {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toMatch(/build/);
    });

    it('should contain .env pattern', () => {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toMatch(/\.env/);
    });

    it('should contain .env.local pattern', () => {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toMatch(/\.env\.local/);
    });

    it('should contain .env.*.local pattern', () => {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toMatch(/\.env\.\*\.local/);
    });

    it('should contain .vscode pattern', () => {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toMatch(/\.vscode/);
    });

    it('should contain .idea pattern', () => {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toMatch(/\.idea/);
    });

    it('should contain .DS_Store pattern', () => {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toMatch(/\.DS_Store/);
    });

    it('should contain log file patterns', () => {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toMatch(/\*\.log/);
      expect(content).toMatch(/npm-debug\.log\*/);
    });

    it('should contain coverage pattern', () => {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toMatch(/coverage/);
    });

    it('should contain .nyc_output pattern', () => {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toMatch(/\.nyc_output/);
    });
  });
});
