import * as fs from 'fs';
import * as path from 'path';

describe('Environment Template Configuration', () => {
  const projectRoot = path.join(__dirname, '..', '..');
  const envExamplePath = path.join(projectRoot, '.env.example');

  describe('.env.example file', () => {
    it('should exist', () => {
      expect(fs.existsSync(envExamplePath)).toBe(true);
    });

    it('should contain NODE_ENV variable', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/NODE_ENV=/);
    });

    it('should contain PORT variable', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/PORT=/);
    });

    it('should contain DB_HOST variable', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/DB_HOST=/);
    });

    it('should contain DB_PORT variable', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/DB_PORT=/);
    });

    it('should contain DB_USERNAME variable', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/DB_USERNAME=/);
    });

    it('should contain DB_PASSWORD variable', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/DB_PASSWORD=/);
    });

    it('should contain DB_DATABASE variable', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/DB_DATABASE=/);
    });

    it('should contain AWS_REGION variable', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/AWS_REGION=/);
    });

    it('should contain AWS_ACCESS_KEY_ID variable', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/AWS_ACCESS_KEY_ID=/);
    });

    it('should contain AWS_SECRET_ACCESS_KEY variable', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/AWS_SECRET_ACCESS_KEY=/);
    });

    it('should contain AWS_S3_BUCKET variable', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/AWS_S3_BUCKET=/);
    });

    it('should contain REDIS_HOST variable', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/REDIS_HOST=/);
    });

    it('should contain REDIS_PORT variable', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/REDIS_PORT=/);
    });

    it('should contain REDIS_PASSWORD variable', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/REDIS_PASSWORD=/);
    });

    it('should have Application section comment', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/# Application/);
    });

    it('should have Database section comment', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/# Database/);
    });

    it('should have AWS S3 section comment', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/# AWS S3/);
    });

    it('should have Redis section comment', () => {
      const content = fs.readFileSync(envExamplePath, 'utf-8');
      expect(content).toMatch(/# Redis/);
    });
  });
});
