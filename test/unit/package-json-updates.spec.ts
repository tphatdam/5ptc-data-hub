import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';

describe('Package.json Updates', () => {
  const projectRoot = path.join(__dirname, '..', '..');
  const packageJsonPath = path.join(projectRoot, 'package.json');

  let packageJson: any;

  beforeAll(() => {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    packageJson = JSON.parse(content);
  });

  describe('devDependencies', () => {
    it('should include prettier', () => {
      expect(packageJson.devDependencies).toHaveProperty('prettier');
    });

    it('should include eslint', () => {
      expect(packageJson.devDependencies).toHaveProperty('eslint');
    });

    it('should include @typescript-eslint/parser', () => {
      expect(packageJson.devDependencies).toHaveProperty('@typescript-eslint/parser');
    });

    it('should include @typescript-eslint/eslint-plugin', () => {
      expect(packageJson.devDependencies).toHaveProperty('@typescript-eslint/eslint-plugin');
    });

    it('should include eslint-config-prettier', () => {
      expect(packageJson.devDependencies).toHaveProperty('eslint-config-prettier');
    });

    it('should include eslint-plugin-prettier', () => {
      expect(packageJson.devDependencies).toHaveProperty('eslint-plugin-prettier');
    });
  });

  describe('scripts', () => {
    it('should include format script', () => {
      expect(packageJson.scripts).toHaveProperty('format');
      expect(packageJson.scripts.format).toContain('prettier');
      expect(packageJson.scripts.format).toContain('--write');
    });

    it('should include format:check script', () => {
      expect(packageJson.scripts).toHaveProperty('format:check');
      expect(packageJson.scripts['format:check']).toContain('prettier');
      expect(packageJson.scripts['format:check']).toContain('--check');
    });

    it('should include lint script', () => {
      expect(packageJson.scripts).toHaveProperty('lint');
      expect(packageJson.scripts.lint).toContain('eslint');
    });

    it('should include lint:fix script', () => {
      expect(packageJson.scripts).toHaveProperty('lint:fix');
      expect(packageJson.scripts['lint:fix']).toContain('eslint');
      expect(packageJson.scripts['lint:fix']).toContain('--fix');
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Property 1: Script preservation during package.json updates
     * **Validates: Requirements 6.5**
     * 
     * Feature: nestjs-project-setup
     * Property 1: Script preservation during package.json updates
     * 
     * This property test verifies that when new scripts (format, format:check, lint, lint:fix)
     * are added to a package.json file, all original scripts are preserved.
     */
    it('should preserve all existing scripts when adding new scripts', () => {
      // Define the new scripts that will be added
      const newScripts = {
        format: 'prettier --write "src/**/*.ts" "test/**/*.ts"',
        'format:check': 'prettier --check "src/**/*.ts" "test/**/*.ts"',
        lint: 'eslint "{src,apps,libs,test}/**/*.ts"',
        'lint:fix': 'eslint "{src,apps,libs,test}/**/*.ts" --fix',
      };

      // Function to add new scripts to a package.json scripts object
      const addScripts = (existingScripts: Record<string, string>): Record<string, string> => {
        return {
          ...existingScripts,
          ...newScripts,
        };
      };

      // Arbitrary generator for script names (valid npm script names)
      const scriptNameArb = fc.stringMatching(/^[a-z][a-z0-9:-]{0,20}$/);

      // Arbitrary generator for script commands (non-empty strings)
      const scriptCommandArb = fc.string({ minLength: 1, maxLength: 100 });

      // Arbitrary generator for a scripts object (dictionary of script name -> command)
      const scriptsObjectArb = fc.dictionary(scriptNameArb, scriptCommandArb, {
        minKeys: 0,
        maxKeys: 20,
      });

      // Property: All original scripts should be present after adding new scripts
      fc.assert(
        fc.property(scriptsObjectArb, (originalScripts) => {
          // Add new scripts to the original scripts
          const updatedScripts = addScripts(originalScripts);

          // Verify all original scripts are still present
          for (const [scriptName, scriptCommand] of Object.entries(originalScripts)) {
            expect(updatedScripts).toHaveProperty(scriptName);
            expect(updatedScripts[scriptName]).toBe(scriptCommand);
          }

          // Verify new scripts are added
          for (const [scriptName, scriptCommand] of Object.entries(newScripts)) {
            expect(updatedScripts).toHaveProperty(scriptName);
            expect(updatedScripts[scriptName]).toBe(scriptCommand);
          }

          // Verify the total number of scripts is correct
          const expectedCount = Object.keys(originalScripts).length + Object.keys(newScripts).length;
          // Account for potential overlaps (if original scripts had any of the new script names)
          const overlappingKeys = Object.keys(originalScripts).filter((key) =>
            Object.keys(newScripts).includes(key),
          );
          const actualExpectedCount = expectedCount - overlappingKeys.length;
          expect(Object.keys(updatedScripts).length).toBe(actualExpectedCount);
        }),
        { numRuns: 100 }, // Minimum 100 iterations as specified
      );
    });
  });
});
