# PDF Generator Service

A NestJS-based service that generates PDF files from JSON data with stock report analysis capabilities.

## Features

- Single POST endpoint to generate PDFs from JSON data
- 30-second timeout protection
- Streaming PDF responses for efficient memory usage
- Basic error handling
- Health check endpoint
- Stock report analysis and data processing
- Database integration with TypeORM
- AWS S3 integration for file storage
- Redis-based job queue with Bull
- Scheduled tasks support

## Development Setup

### Prerequisites

- Node.js (v18 or higher recommended)
- PostgreSQL database
- Redis server
- AWS S3 account (for file storage)

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Configure environment variables:

```bash
# Copy the environment template
cp .env.example .env

# Edit .env and fill in your actual values:
# - DATABASE_URL (PostgreSQL; add ?sslmode=require or set DATABASE_SSL=true for SSL)
# - REDIS_URL (e.g. redis://localhost:6379 for local)
# - AWS S3 credentials and bucket name
# - API keys (OpenAI, Sendinblue)
```

3. Run database migrations:

```bash
npm run migration:run
```

Migration note:

- `npm run migration:run` is the single official migration command.
- It runs both legacy migrations (`src/db/migrations`) and data-hub migrations (`src/modules/data-hub/migrations`) in timestamp order.

4. (Optional) Seed the database with initial data:

```bash
npm run db:seed
```

### Development Tools

This project includes several configuration files for maintaining code quality and consistency:

#### Code Formatting with Prettier

Prettier is configured to automatically format your code according to project standards.

- **Format all code**: `npm run format`
- **Check formatting without changes**: `npm run format:check`

Configuration is defined in `.prettierrc` with the following settings:

- Single quotes for strings
- Trailing commas in all multi-line structures
- 100 character line width
- 2-space indentation
- Semicolons required

Files excluded from formatting are listed in `.prettierignore`.

#### Code Linting with ESLint

ESLint checks your code for potential issues and enforces coding standards.

- **Run linter**: `npm run lint`
- **Auto-fix linting issues**: `npm run lint:fix`

Configuration is defined in `.eslintrc.js` with:

- TypeScript support via `@typescript-eslint/parser`
- NestJS-recommended rules
- Prettier integration (no conflicting rules)

Files excluded from linting are listed in `.eslintignore`.

#### Editor Configuration

The `.editorconfig` file ensures consistent coding styles across different editors and IDEs:

- UTF-8 character encoding
- 2-space indentation
- LF (Unix-style) line endings
- Automatic trailing whitespace removal
- Final newline insertion

Most modern editors support EditorConfig automatically or via plugins.

#### Version Control

The `.gitignore` file is configured to exclude:

- Dependencies (`node_modules/`)
- Build outputs (`dist/`, `build/`)
- Environment files (`.env`, `.env.local`)
- IDE-specific files (`.vscode/`, `.idea/`, `.DS_Store`)
- Log files and temporary files
- Test coverage reports

### Running the Application

Development mode with hot-reload:

```bash
npm run start:dev
```

Production mode:

```bash
npm run build
npm run start:prod
```

Debug mode:

```bash
npm run start:debug
```

### Testing

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Generate coverage report:

```bash
npm run test:cov
```

## API Documentation

Interactive Swagger documentation is available at: **http://localhost:5000/api-docs**

The Swagger UI provides:

- Complete API specification
- Interactive endpoint testing
- Request/response examples
- Schema definitions

## API Endpoints

### POST /generate-pdf

Generates a PDF from the provided JSON data.

**Request:**

```json
{
  "report_json": {
    "title": "Your Report Title",
    "data": "Any JSON structure"
  }
}
```

**Response:**

- Success: PDF file download (application/pdf)
- Error 400: Missing report_json
- Error 408: Request timeout (30s)
- Error 500: PDF generation failed

**Example:**

```bash
curl -X POST http://localhost:5000/generate-pdf \
  -H "Content-Type: application/json" \
  -d '{"report_json": {"title": "Test Report", "content": "Hello World"}}' \
  --output report.pdf
```

### GET /health

Check service status.

**Response:**

```json
{
  "status": "ok",
  "service": "pdf-generator"
}
```

## Usage

1. Start the server:

```bash
node index.js
```

2. Send a POST request with your JSON data:

```bash
curl -X POST http://localhost:5000/generate-pdf \
  -H "Content-Type: application/json" \
  -d '{"report_json": {"your": "data"}}' \
  --output output.pdf
```

3. Or run the test script:

```bash
bash test-api.sh
```

## Configuration

- **Port:** 5000
- **Timeout:** 30 seconds
- **Max JSON payload:** 10MB
- **PDF format:** A4 with 20px margins

## Technical Details

- Built with Express.js and Puppeteer
- Uses system-installed Chromium for PDF rendering
- Reuses browser instance for better performance
- Graceful shutdown handling

# 5ptc-data-hub
