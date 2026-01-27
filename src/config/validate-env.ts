import 'reflect-metadata';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateIf,
  validateSync,
} from 'class-validator';
import { plainToClass } from 'class-transformer';

export class EnvironmentVariables {
  @IsEnum(['development', 'production', 'test'])
  @IsNotEmpty()
  NODE_ENV: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsString()
  @IsNotEmpty()
  LOG_LEVEL: string;

  // Database configuration - either DATABASE_URL or discrete variables
  @IsOptional()
  @IsString()
  DATABASE_URL?: string;

  @ValidateIf((o) => !o.DATABASE_URL)
  @IsString()
  @IsNotEmpty()
  DB_HOST?: string;

  @ValidateIf((o) => !o.DATABASE_URL)
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT?: number;

  @ValidateIf((o) => !o.DATABASE_URL)
  @IsString()
  @IsNotEmpty()
  DB_USER?: string;

  @ValidateIf((o) => !o.DATABASE_URL)
  @IsString()
  @IsNotEmpty()
  DB_PASS?: string;

  @ValidateIf((o) => !o.DATABASE_URL)
  @IsString()
  @IsNotEmpty()
  DB_NAME?: string;

  // Optional HTTP configuration
  @IsOptional()
  @IsInt()
  @Min(1000)
  HTTP_TIMEOUT_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  HTTP_RETRIES?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  HTTP_RETRY_BASE_MS?: number;

  @IsOptional()
  @IsString()
  INTERNAL_API_KEY?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => {
        const constraints = Object.values(error.constraints || {});
        return `${error.property}: ${constraints.join(', ')}`;
      })
      .join('\n');

    throw new Error(`Configuration validation failed:\n${errorMessages}`);
  }

  return validatedConfig;
}
