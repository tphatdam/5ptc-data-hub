# Implementation Plan: NestJS Project Setup

## Overview

This implementation plan breaks down the NestJS project setup into discrete configuration file creation tasks. Each task creates specific configuration files with appropriate content, following NestJS best practices. The implementation is purely configuration-based with no runtime code changes.

## Tasks

- [x] 1. Create Prettier configuration files
  - Create .prettierrc with NestJS-appropriate formatting rules (singleQuote, trailingComma, printWidth, tabWidth, semi, arrowParens, endOfLine)
  - Create .prettierignore to exclude node_modules, dist, build, coverage, package-lock.json, and generated files
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 1.1 Write unit tests for Prettier configuration
  - Test that .prettierrc file is created with correct JSON structure
  - Test that .prettierrc contains all required settings (singleQuote: true, trailingComma: "all", printWidth: 100, etc.)
  - Test that .prettierignore file is created with correct exclusion patterns
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Create ESLint configuration files
  - Create .eslintrc.js with TypeScript parser, NestJS-recommended rules, and Prettier integration
  - Include @typescript-eslint/parser, @typescript-eslint/eslint-plugin, and eslint-config-prettier in extends
  - Create .eslintignore to exclude node_modules, dist, build, coverage, and config files
  - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [x] 2.1 Write unit tests for ESLint configuration
  - Test that .eslintrc.js file is created and exports valid configuration object
  - Test that parser is set to '@typescript-eslint/parser'
  - Test that plugins include '@typescript-eslint/eslint-plugin'
  - Test that extends includes 'plugin:prettier/recommended' for Prettier integration
  - Test that .eslintignore file is created with correct exclusion patterns
  - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [x] 3. Create Git ignore file
  - Create .gitignore with comprehensive exclusion patterns
  - Include patterns for: node_modules, dist/build outputs, environment files (.env*), IDE files (.vscode, .idea, .DS_Store), log files, coverage reports, and OS-specific files
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3.1 Write unit tests for Git ignore configuration
  - Test that .gitignore file is created
  - Test that .gitignore contains node_modules pattern
  - Test that .gitignore contains dist and build patterns
  - Test that .gitignore contains .env patterns (.env, .env.local, .env.*.local)
  - Test that .gitignore contains IDE patterns (.vscode, .idea, .DS_Store)
  - Test that .gitignore contains log file patterns (*.log, npm-debug.log*)
  - Test that .gitignore contains coverage patterns (coverage/, .nyc_output/)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 4. Create EditorConfig file
  - Create .editorconfig with cross-editor formatting rules
  - Set charset=utf-8, indent_style=space, indent_size=2, end_of_line=lf, insert_final_newline=true, trim_trailing_whitespace=true
  - Add special rule for Markdown files to preserve trailing whitespace
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 4.1 Write unit tests for EditorConfig
  - Test that .editorconfig file is created
  - Test that .editorconfig contains charset, indent_style, and indent_size settings
  - Test that .editorconfig contains end_of_line and trim_trailing_whitespace settings
  - Test that .editorconfig has special Markdown section
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 5. Create environment variable template
  - Create .env.example with placeholder environment variables
  - Include sections for: Application (NODE_ENV, PORT), Database (DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE), AWS S3 (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET), Redis (REDIS_HOST, REDIS_PORT, REDIS_PASSWORD), and third-party APIs (OPENAI_API_KEY, SENDINBLUE_API_KEY)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5.1 Write unit tests for environment template
  - Test that .env.example file is created
  - Test that .env.example contains NODE_ENV and PORT variables
  - Test that .env.example contains database variables (DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE)
  - Test that .env.example contains AWS variables (AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET)
  - Test that .env.example contains Redis variables (REDIS_HOST, REDIS_PORT, REDIS_PASSWORD)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 6. Update package.json with new scripts and dependencies
  - [x] 6.1 Add development dependencies to package.json
    - Add prettier, eslint, @typescript-eslint/parser, @typescript-eslint/eslint-plugin, eslint-config-prettier, eslint-plugin-prettier to devDependencies
    - Use compatible versions (prettier: ^3.2.5, eslint: ^8.57.0, @typescript-eslint/*: ^7.0.0, eslint-config-prettier: ^9.1.0, eslint-plugin-prettier: ^5.1.3)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [x] 6.2 Add formatting and linting scripts to package.json
    - Add "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\""
    - Add "format:check": "prettier --check \"src/**/*.ts\" \"test/**/*.ts\""
    - Add "lint": "eslint \"{src,apps,libs,test}/**/*.ts\""
    - Add "lint:fix": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix"
    - Preserve all existing scripts in package.json
    - _Requirements: 1.4, 2.4, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 6.3 Write unit tests for package.json updates
  - Test that package.json devDependencies includes prettier
  - Test that package.json devDependencies includes eslint and all required plugins
  - Test that package.json scripts includes format and format:check
  - Test that package.json scripts includes lint and lint:fix
  - _Requirements: 1.4, 2.4, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 6.4 Write property test for package.json script preservation
  - **Property 1: Script preservation during package.json updates**
  - **Validates: Requirements 6.5**
  - Generate random package.json files with various existing scripts
  - Add new scripts (format, format:check, lint, lint:fix) to each
  - Verify all original scripts are still present after update
  - Use fast-check library with minimum 100 iterations
  - Tag: **Feature: nestjs-project-setup, Property 1: Script preservation during package.json updates**
  - _Requirements: 6.5_

- [x] 7. Checkpoint - Verify all configuration files
  - Ensure all configuration files are created (.prettierrc, .prettierignore, .eslintrc.js, .eslintignore, .gitignore, .editorconfig, .env.example)
  - Ensure package.json is updated with new scripts and dependencies
  - Ensure all tests pass
  - Ask the user if questions arise

- [x] 8. Create setup documentation
  - Add a section to README.md explaining the new configuration files
  - Document how to run formatting (npm run format) and linting (npm run lint)
  - Document that developers need to run `npm install` to install new dependencies
  - Document that developers should copy .env.example to .env and fill in actual values
  - _Requirements: All requirements (documentation)_

## Notes

- All configuration files follow NestJS best practices and community conventions
- The implementation is non-destructive and preserves existing project files
- After completing these tasks, developers should run `npm install` to install new dependencies
- Configuration files can be customized further based on team preferences
