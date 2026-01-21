import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig, AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

/**
 * HttpClientService wraps @nestjs/axios HttpService with retry logic,
 * timeout handling, and request sanitization for logging.
 *
 * Features:
 * - Configurable timeout from HTTP_TIMEOUT_MS
 * - Exponential backoff retry logic
 * - Retry on network errors, 5xx, and 429 status codes
 * - Respects Retry-After header on 429 responses
 * - Random User-Agent header from predefined list
 * - Sanitized logging (removes sensitive headers)
 */
@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;

  // Predefined User-Agent list for rotation
  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  ];

  // Sensitive headers to exclude from logs
  private readonly sensitiveHeaders = [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'api-key',
    'token',
    'x-auth-token',
    'x-csrf-token',
  ];

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.timeoutMs = this.configService.get<number>('http.timeoutMs', 30000);
    this.maxRetries = this.configService.get<number>('http.retries', 3);
    this.retryBaseMs = this.configService.get<number>('http.retryBaseMs', 1000);
  }

  /**
   * Perform a GET request with retry logic and timeout
   * @param url - The URL to request
   * @param config - Optional Axios request configuration
   * @returns Parsed JSON response
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.executeWithRetry<T>(async () => {
      const mergedConfig = this.prepareConfig(config);
      const response = await firstValueFrom(
        this.httpService.get<T>(url, mergedConfig),
      );
      return response.data;
    }, url, 'GET');
  }

  /**
   * Perform a POST request with retry logic and timeout
   * @param url - The URL to request
   * @param data - The data to send in the request body
   * @param config - Optional Axios request configuration
   * @returns Parsed JSON response
   */
  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return this.executeWithRetry<T>(async () => {
      const mergedConfig = this.prepareConfig(config);
      const response = await firstValueFrom(
        this.httpService.post<T>(url, data, mergedConfig),
      );
      return response.data;
    }, url, 'POST');
  }

  /**
   * Prepare request configuration with timeout and User-Agent
   */
  private prepareConfig(config?: AxiosRequestConfig): AxiosRequestConfig {
    const userAgent = this.getRandomUserAgent();

    return {
      ...config,
      timeout: this.timeoutMs,
      headers: {
        ...config?.headers,
        'User-Agent': userAgent,
      },
    };
  }

  /**
   * Execute a request with exponential backoff retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    url: string,
    method: string,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry
        if (attempt === this.maxRetries || !this.isRetryableError(error)) {
          // Log the final failure with sanitized headers
          this.logRequestFailure(url, method, error, attempt);
          throw error;
        }

        // Calculate delay with exponential backoff
        const delayMs = this.calculateRetryDelay(error, attempt);

        this.logger.warn(
          `Request failed (attempt ${attempt + 1}/${this.maxRetries + 1}): ${method} ${url}. Retrying in ${delayMs}ms...`,
        );

        // Wait before retrying
        await this.sleep(delayMs);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError;
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors (ECONNREFUSED, ETIMEDOUT, etc.)
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // Axios timeout error
    if (error.code === 'ECONNABORTED') {
      return true;
    }

    // HTTP status code errors
    if (error.response) {
      const status = error.response.status;
      // Retry on 5xx server errors or 429 rate limit
      return status >= 500 || status === 429;
    }

    return false;
  }

  /**
   * Calculate retry delay with exponential backoff
   * Respects Retry-After header for 429 responses
   */
  private calculateRetryDelay(error: any, attempt: number): number {
    // Check for Retry-After header on 429 responses
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      if (retryAfter) {
        const retryAfterSeconds = parseInt(retryAfter, 10);
        if (!isNaN(retryAfterSeconds)) {
          return retryAfterSeconds * 1000; // Convert to milliseconds
        }
      }
    }

    // Exponential backoff: baseMs * 2^attempt
    return this.retryBaseMs * Math.pow(2, attempt);
  }

  /**
   * Get a random User-Agent from the predefined list
   */
  private getRandomUserAgent(): string {
    const index = Math.floor(Math.random() * this.userAgents.length);
    return this.userAgents[index];
  }

  /**
   * Log request failure with sanitized headers
   */
  private logRequestFailure(
    url: string,
    method: string,
    error: any,
    attempt: number,
  ): void {
    const axiosError = error as AxiosError;

    // Sanitize request headers
    const sanitizedRequestHeaders = this.sanitizeHeaders(
      axiosError.config?.headers,
    );

    // Sanitize response headers
    const sanitizedResponseHeaders = this.sanitizeHeaders(
      axiosError.response?.headers,
    );

    this.logger.error(
      `HTTP request failed after ${attempt + 1} attempts: ${method} ${url}`,
      {
        method,
        url,
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        requestHeaders: sanitizedRequestHeaders,
        responseHeaders: sanitizedResponseHeaders,
        errorCode: axiosError.code,
        errorMessage: axiosError.message,
      },
    );
  }

  /**
   * Remove sensitive headers from logging
   */
  private sanitizeHeaders(headers: any): Record<string, any> {
    if (!headers) {
      return {};
    }

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (this.sensitiveHeaders.includes(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
