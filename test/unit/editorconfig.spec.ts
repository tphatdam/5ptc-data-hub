import * as fs from 'fs';
import * as path from 'path';

describe('EditorConfig Configuration', () => {
  const projectRoot = path.join(__dirname, '..', '..');
  const editorconfigPath = path.join(projectRoot, '.editorconfig');

  describe('.editorconfig file', () => {
    it('should exist', () => {
      expect(fs.existsSync(editorconfigPath)).toBe(true);
    });

    it('should contain charset setting', () => {
      const content = fs.readFileSync(editorconfigPath, 'utf-8');
      expect(content).toMatch(/charset\s*=\s*utf-8/);
    });

    it('should contain indent_style setting', () => {
      const content = fs.readFileSync(editorconfigPath, 'utf-8');
      expect(content).toMatch(/indent_style\s*=\s*space/);
    });

    it('should contain indent_size setting', () => {
      const content = fs.readFileSync(editorconfigPath, 'utf-8');
      expect(content).toMatch(/indent_size\s*=\s*2/);
    });

    it('should contain end_of_line setting', () => {
      const content = fs.readFileSync(editorconfigPath, 'utf-8');
      expect(content).toMatch(/end_of_line\s*=\s*lf/);
    });

    it('should contain insert_final_newline setting', () => {
      const content = fs.readFileSync(editorconfigPath, 'utf-8');
      expect(content).toMatch(/insert_final_newline\s*=\s*true/);
    });

    it('should contain trim_trailing_whitespace setting', () => {
      const content = fs.readFileSync(editorconfigPath, 'utf-8');
      expect(content).toMatch(/trim_trailing_whitespace\s*=\s*true/);
    });

    it('should have special Markdown section', () => {
      const content = fs.readFileSync(editorconfigPath, 'utf-8');
      expect(content).toMatch(/\[\*\.md\]/);
    });

    it('should preserve trailing whitespace in Markdown files', () => {
      const content = fs.readFileSync(editorconfigPath, 'utf-8');
      // Check that the Markdown section has trim_trailing_whitespace = false
      const markdownSection = content.split('[*.md]')[1];
      expect(markdownSection).toBeDefined();
      expect(markdownSection).toMatch(/trim_trailing_whitespace\s*=\s*false/);
    });

    it('should have root = true at the top', () => {
      const content = fs.readFileSync(editorconfigPath, 'utf-8');
      expect(content).toMatch(/^root\s*=\s*true/);
    });
  });
});
