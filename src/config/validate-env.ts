import 'reflect-metadata';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
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

  // Database - DATABASE_URL required
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  // Redis - REDIS_URL required
  @IsString()
  @IsNotEmpty()
  REDIS_URL: string;

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

  @IsOptional()
  @IsString()
  VN_STOCK_API_URL?: string;

  @IsOptional()
  @IsString()
  VIETSTOCK_BASE?: string;

  @IsOptional()
  @IsString()
  VIETSTOCK_COOKIE?: string;

  @IsOptional()
  @IsString()
  FIREANT_BASE_URL?: string;

  @IsOptional()
  @IsString()
  FIREANT_TOKEN?: string;

  @IsOptional()
  @IsString()
  AI_CRAWLER_API_URL?: string;

  @IsOptional()
  @IsString()
  VNDIRECT_BASE_URL?: string;

  @IsOptional()
  @IsString()
  PAYMENT_AMOUNT?: string;
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
