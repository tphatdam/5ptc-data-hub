# Design Document: NestJS Project Setup

## Overview

This design outlines the implementation for completing the NestJS project setup by adding essential configuration files. The solution will add Prettier for code formatting, ESLint for code quality, .gitignore for version control, EditorConfig for editor consistency, and environment templates. All configurations will follow NestJS best practices and industry standards.

The implementation is purely configuration-based with no runtime code changes. All files will be created in the project root directory and will integrate seamlessly with the existing NestJS project structure.

## Architecture

The project setup consists of independent configuration files that work together to provide a complete development environment:

```
5ptc-data-hub/
├── .prettierrc              # Prettier formatting rules
├── .prettierignore          # Files to exclude from formatting
├── .eslintrc.js             # ESLint linting rules
├── .eslintignore            # Files to exclude from linting
├── .gitignore               # Git version control exclusions
├── .editorconfig            # Cross-editor formatting rules
├── .env.example             # Environment variable template
└── package.json             # Updated with new scripts and dependencies
```

**Configuration Flow:**
1. EditorConfig provides baseline editor settings (indent, charset, line endings)
2. Prettier enforces code formatting on top of EditorConfig
3. ESLint checks code quality and integrates with Prettier via eslint-config-prettier
4. Git ignores generated files, dependencies, and sensitive data
5. Environment template documents required configuration

**Integration Points:**
- ESLint and Prettier are configured to work together without conflicts
- All tools respect .gitignore patterns
- npm scripts provide convenient access to all tools
- Configuration files follow NestJS community conventions

## Components and Interfaces

### 1. Prettier Configuration (.prettierrc)

**Purpose:** Define code formatting rules for consistent style across the project.

**Configuration Structure:**
```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

**Key Settings:**
- `singleQuote: true` - Matches NestJS convention
- `trailingComma: "all"` - Cleaner git diffs
- `printWidth: 100` - Reasonable line length for modern displays
- `tabWidth: 2` - Standard for TypeScript/JavaScript
- `semi: true` - Explicit statement termination
- `arrowParens: "always"` - Consistent arrow function syntax
- `endOfLine: "lf"` - Unix-style line endings

### 2. Prettier Ignore (.prettierignore)

**Purpose:** Exclude files that should not be formatted.

**Exclusion Patterns:**
```
# Dependencies
node_modules/
package-lock.json

# Build outputs
dist/
build/
coverage/

# Generated files
*.min.js
*.min.css

# Logs
*.log
```

### 3. ESLint Configuration (.eslintrc.js)

**Purpose:** Define code quality rules and integrate with TypeScript and Prettier.

**Configuration Structure:**
```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
```

**Key Components:**
- **Parser:** `@typescript-eslint/parser` for TypeScript support
- **Plugins:** `@typescript-eslint/eslint-plugin` for TypeScript rules
- **Extends:** Recommended TypeScript rules + Prettier integration
- **Rules:** Relaxed rules matching NestJS defaults (can be tightened later)

### 4. ESLint Ignore (.eslintignore)

**Purpose:** Exclude files that should not be linted.

**Exclusion Patterns:**
```
# Dependencies
node_modules/

# Build outputs
dist/
build/
coverage/

# Configuration files
*.config.js
.eslintrc.js
```

### 5. Git Ignore (.gitignore)

**Purpose:** Exclude files from version control.

**Exclusion Categories:**

**Dependencies:**
```
node_modules/
```

**Build Outputs:**
```
dist/
build/
*.tsbuildinfo
```

**Environment Files:**
```
.env
.env.local
.env.*.local
```

**IDE Files:**
```
.vscode/
.idea/
*.swp
*.swo
.DS_Store
```

**Logs and Temporary Files:**
```
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
.pnpm-debug.log*
```

**Test Coverage:**
```
coverage/
.nyc_output/
```

**OS Files:**
```
Thumbs.db
.DS_Store
```

### 6. EditorConfig (.editorconfig)

**Purpose:** Maintain consistent coding styles across different editors and IDEs.

**Configuration:**
```ini
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

**Key Settings:**
- Universal UTF-8 encoding
- 2-space indentation (matches TypeScript convention)
- LF line endings (Unix-style)
- Final newline insertion
- Trailing whitespace removal (except in Markdown)

### 7. Environment Template (.env.example)

**Purpose:** Document required environment variables without exposing sensitive values.

**Template Structure:**
```bash
# Application
NODE_ENV=development
PORT=3000

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password_here
DB_DATABASE=your_database_name

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_S3_BUCKET=your_bucket_name

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# OpenAI (if applicable)
OPENAI_API_KEY=your_openai_key_here

# Sendinblue/Brevo (if applicable)
SENDINBLUE_API_KEY=your_sendinblue_key_here
```

**Variable Categories:**
- Application settings (NODE_ENV, PORT)
- Database connection (based on TypeORM usage)
- AWS S3 (based on @aws-sdk/client-s3 usage)
- Redis (based on Bull/IORedis usage)
- Third-party APIs (OpenAI, Sendinblue based on dependencies)

### 8. Package.json Updates

**Purpose:** Add scripts and dependencies for the new configuration tools.

**New Scripts:**
```json
{
  "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
  "format:check": "prettier --check \"src/**/*.ts\" \"test/**/*.ts\"",
  "lint": "eslint \"{src,apps,libs,test}/**/*.ts\"",
  "lint:fix": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix"
}
```

**New DevDependencies:**
```json
{
  "@typescript-eslint/eslint-plugin": "^7.0.0",
  "@typescript-eslint/parser": "^7.0.0",
  "eslint": "^8.57.0",
  "eslint-config-prettier": "^9.1.0",
  "eslint-plugin-prettier": "^5.1.3",
  "prettier": "^3.2.5"
}
```

## Data Models

This feature does not involve runtime data models. All components are static configuration files that define rules for development tools.

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Since this feature involves creating static configuration files with specific content, most acceptance criteria are best validated through example-based tests that verify the exact content of created files. However, there is one universal property that applies:

**Property 1: Script preservation during package.json updates**

*For any* existing package.json file with a scripts section, when new scripts are added (format, format:check, lint, lint:fix), all original scripts should remain present in the updated package.json.

**Validates: Requirements 6.5**

**Rationale:** This property ensures that the setup process is non-destructive and doesn't accidentally remove existing functionality. It should hold regardless of what scripts already exist in the package.json.

**Example-Based Tests:**

The remaining acceptance criteria are best validated through example-based tests that verify:

1. **File Creation Tests** - Verify that each configuration file is created (.prettierrc, .prettierignore, .eslintrc.js, .eslintignore, .gitignore, .editorconfig, .env.example)
   - **Validates: Requirements 1.1, 1.2, 2.1, 2.2, 3.1, 4.1, 5.1**

2. **Prettier Configuration Tests** - Verify .prettierrc contains expected settings (singleQuote, trailingComma, printWidth)
   - **Validates: Requirements 1.3**

3. **ESLint Configuration Tests** - Verify .eslintrc.js contains TypeScript parser, plugins, and prettier integration
   - **Validates: Requirements 2.3, 2.5**

4. **Git Ignore Pattern Tests** - Verify .gitignore contains all required patterns (node_modules, dist, .env, IDE files, logs, coverage)
   - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

5. **EditorConfig Tests** - Verify .editorconfig contains charset, indent settings, and line ending settings
   - **Validates: Requirements 4.2, 4.3**

6. **Environment Template Tests** - Verify .env.example contains all required variable categories (app, database, AWS, Redis)
   - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**

7. **Package.json Script Tests** - Verify package.json contains new scripts (format, format:check, lint, lint:fix)
   - **Validates: Requirements 1.4, 2.4, 6.1, 6.2, 6.3, 6.4**

8. **Package.json Dependency Tests** - Verify package.json devDependencies contains all required packages (prettier, eslint, plugins)
   - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

## Error Handling

This feature involves file creation and modification. Error handling considerations:

**File System Errors:**
- If a configuration file already exists, the implementation should either:
  - Skip creation and warn the user, OR
  - Merge with existing content where appropriate (e.g., package.json scripts)
- If file write permissions are denied, fail with a clear error message
- If the target directory doesn't exist, create it before writing files

**Package.json Modifications:**
- Validate that package.json exists before attempting to modify it
- Parse package.json as valid JSON before making changes
- Preserve existing formatting and structure when adding new entries
- If package.json is malformed, fail with a clear error message

**Dependency Installation:**
- The implementation should add dependencies to package.json but NOT automatically run npm install
- Inform the user to run `npm install` after configuration files are created
- If specific dependency versions conflict with existing dependencies, use compatible versions

**Validation:**
- After creating each configuration file, verify it's valid (e.g., JSON files are valid JSON)
- For .eslintrc.js, ensure it exports a valid JavaScript object
- For .editorconfig, ensure it follows INI format

## Testing Strategy

This feature uses a **dual testing approach** combining unit tests and property-based tests:

**Unit Tests:**
Unit tests will verify specific examples and edge cases for configuration file creation. They focus on:
- Verifying each configuration file is created with correct content
- Checking that specific configuration values match expected values
- Testing file existence and content patterns
- Validating package.json modifications

**Property-Based Tests:**
Property tests will verify universal properties across different inputs. They focus on:
- Testing that package.json script preservation works for any existing scripts
- Verifying non-destructive updates across various initial states

**Testing Framework:**
- Use Jest (already configured in the project)
- For property-based testing, use **fast-check** library for TypeScript/JavaScript
- Configure property tests to run minimum 100 iterations
- Tag each property test with: **Feature: nestjs-project-setup, Property 1: Script preservation during package.json updates**

**Test Organization:**
```
test/
├── unit/
│   ├── prettier-config.spec.ts
│   ├── eslint-config.spec.ts
│   ├── gitignore.spec.ts
│   ├── editorconfig.spec.ts
│   ├── env-template.spec.ts
│   └── package-json-updates.spec.ts
└── property/
    └── package-json-preservation.spec.ts
```

**Test Coverage Goals:**
- 100% coverage for configuration file creation logic
- Verify all acceptance criteria through automated tests
- Test both success cases and error conditions
- Validate that existing project files are not corrupted

**Integration Testing:**
After creating all configuration files:
1. Run `npm install` to install new dependencies
2. Run `npm run format:check` to verify Prettier configuration works
3. Run `npm run lint` to verify ESLint configuration works
4. Verify no conflicts between ESLint and Prettier
5. Test that all configuration files are properly ignored by Git
