# Configuration Module

This directory contains the configuration management system for vnstock-hub.

## Files

### configuration.ts
Loads environment variables and provides typed configuration objects for:
- **app**: Application settings (NODE_ENV, PORT, LOG_LEVEL)
- **database**: Database connection settings (supports both DATABASE_URL and discrete variables)
- **http**: HTTP client settings (timeout, retries, retry base delay)

### validate-env.ts
Validates environment variables at application startup using class-validator decorators.

## Environment Variables

### Required Variables
- `NODE_ENV`: Application environment (development, production, test)
- `PORT`: Server port (1-65535)
- `LOG_LEVEL`: Logging level (info, debug, warn, error)

### Database Configuration
You can use either:
- `DATABASE_URL`: Full PostgreSQL connection string (e.g., postgresql://user:pass@host:port/db)

OR discrete variables:
- `DB_HOST`: Database host
- `DB_PORT`: Database port
- `DB_USER`: Database username
- `DB_PASS`: Database password
- `DB_NAME`: Database name

### Optional HTTP Configuration
- `HTTP_TIMEOUT_MS`: Request timeout in milliseconds (default: 30000, min: 1000)
- `HTTP_RETRIES`: Number of retry attempts (default: 3, max: 10)
- `HTTP_RETRY_BASE_MS`: Base delay for exponential backoff (default: 1000, min: 100)

## Usage

The configuration is automatically loaded and validated when the application starts. If validation fails, the application will exit with a descriptive error message.

```typescript
import { ConfigService } from '@nestjs/config';

constructor(private configService: ConfigService) {}

// Access configuration values
const port = this.configService.get<number>('app.port');
const dbHost = this.configService.get<string>('database.host');
const timeout = this.configService.get<number>('http.timeoutMs');
```

## Validation

The validation ensures:
- All required variables are present
- Values are in the correct format and range
- Database configuration is complete (either URL or all discrete variables)
- The application fails fast with clear error messages if misconfigured
