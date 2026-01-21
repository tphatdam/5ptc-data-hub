import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { HttpClientService } from '../../src/providers/http-client.service';
import { of, throwError } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';

describe('HttpClientService - Property Tests', () => {
  let service: HttpClientService;
  let httpService: HttpService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HttpClientService,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'http.timeoutMs': 5000, // Shorter timeout for tests
                'http.retries': 3,
                'http.retryBaseMs': 100, // Shorter base delay for tests
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<HttpClientService>(HttpClientService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 11: Request timeout enforcement', () => {
    /**
     * **Validates: Requirements 6.2**
     * 
     * For any HTTP request that takes longer than HTTP_TIMEOUT_MS milliseconds, 
     * the request should timeout and throw an error.
     */
    it('should timeout requests that exceed HTTP_TIMEOUT_MS', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            url: fc.webUrl(),
            method: fc.constantFrom('GET', 'POST'),
          }),
          async ({ url, method }) => {
            // Create a timeout error
            const timeoutError: Partial<AxiosError> = {
              code: 'ECONNABORTED',
              message: 'timeout of 5000ms exceeded',
              config: {} as any,
              isAxiosError: true,
              toJSON: () => ({}),
              name: 'AxiosError',
            };

            jest.spyOn(httpService, method.toLowerCase() as any)
              .mockReturnValue(throwError(() => timeoutError));

            // Request should throw timeout error
            await expect(
              method === 'GET' 
                ? service.get(url) 
                : service.post(url, {})
            ).rejects.toMatchObject({
              code: 'ECONNABORTED',
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 12: Retry with exponential backoff', () => {
    /**
     * **Validates: Requirements 6.3, 6.4**
     * 
     * For any retryable HTTP error (network error, 5xx, 429), the client should 
     * retry up to HTTP_RETRIES times with exponentially increasing delays based 
     * on HTTP_RETRY_BASE_MS.
     */
    it('should retry on 5xx errors with exponential backoff', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            url: fc.webUrl(),
            statusCode: fc.integer({ min: 500, max: 599 }),
            successAfterAttempts: fc.integer({ min: 1, max: 3 }),
          }),
          async ({ url, statusCode, successAfterAttempts }) => {
            const mockError: Partial<AxiosError> = {
              response: {
                status: statusCode,
                statusText: 'Server Error',
                data: {},
                headers: {},
                config: {} as any,
              },
              config: {} as any,
              isAxiosError: true,
              toJSON: () => ({}),
              name: 'AxiosError',
              message: `Request failed with status code ${statusCode}`,
            };

            const mockSuccess: AxiosResponse = {
              data: { success: true },
              status: 200,
              statusText: 'OK',
              headers: {},
              config: {} as any,
            };

            const getSpy = jest.spyOn(httpService, 'get');
            
            // Fail N-1 times, then succeed
            for (let i = 0; i < successAfterAttempts - 1; i++) {
              getSpy.mockReturnValueOnce(throwError(() => mockError));
            }
            getSpy.mockReturnValueOnce(of(mockSuccess));

            const startTime = Date.now();
            const result = await service.get(url);
            const duration = Date.now() - startTime;

            // Should succeed after retries
            expect(result).toEqual({ success: true });
            
            // Should have called the service the correct number of times
            expect(getSpy).toHaveBeenCalledTimes(successAfterAttempts);

            // Should have waited with exponential backoff
            // For N attempts, minimum wait time is sum of: 100*2^0 + 100*2^1 + ... + 100*2^(N-2)
            if (successAfterAttempts > 1) {
              const minWaitTime = Array.from({ length: successAfterAttempts - 1 })
                .reduce((sum: number, _, i) => sum + 100 * Math.pow(2, i), 0);
              expect(duration).toBeGreaterThanOrEqual(minWaitTime * 0.9); // Allow 10% margin
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // 30 second timeout for retry tests

    it('should retry on network errors with exponential backoff', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            url: fc.webUrl(),
            errorCode: fc.constantFrom('ECONNREFUSED', 'ETIMEDOUT', 'ECONNABORTED'),
            successAfterAttempts: fc.integer({ min: 1, max: 3 }),
          }),
          async ({ url, errorCode, successAfterAttempts }) => {
            const mockError: Partial<AxiosError> = {
              code: errorCode,
              message: `Network error: ${errorCode}`,
              config: {} as any,
              isAxiosError: true,
              toJSON: () => ({}),
              name: 'AxiosError',
            };

            const mockSuccess: AxiosResponse = {
              data: { success: true },
              status: 200,
              statusText: 'OK',
              headers: {},
              config: {} as any,
            };

            const getSpy = jest.spyOn(httpService, 'get');
            
            // Fail N-1 times, then succeed
            for (let i = 0; i < successAfterAttempts - 1; i++) {
              getSpy.mockReturnValueOnce(throwError(() => mockError));
            }
            getSpy.mockReturnValueOnce(of(mockSuccess));

            const result = await service.get(url);

            // Should succeed after retries
            expect(result).toEqual({ success: true });
            expect(getSpy).toHaveBeenCalledTimes(successAfterAttempts);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should exhaust retries and throw error after max attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            url: fc.webUrl(),
            statusCode: fc.integer({ min: 500, max: 599 }),
          }),
          async ({ url, statusCode }) => {
            const mockError: Partial<AxiosError> = {
              response: {
                status: statusCode,
                statusText: 'Server Error',
                data: {},
                headers: {},
                config: {} as any,
              },
              config: {} as any,
              isAxiosError: true,
              toJSON: () => ({}),
              name: 'AxiosError',
              message: `Request failed with status code ${statusCode}`,
            };

            jest.spyOn(httpService, 'get')
              .mockReturnValue(throwError(() => mockError));

            // Should throw after exhausting retries
            await expect(service.get(url)).rejects.toMatchObject({
              response: {
                status: statusCode,
              },
            });

            // Should have tried 4 times (1 initial + 3 retries)
            expect(httpService.get).toHaveBeenCalledTimes(4);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });

  describe('Property 13: Retry-After header respect', () => {
    /**
     * **Validates: Requirements 6.5**
     * 
     * For any HTTP 429 response with a Retry-After header, the next retry attempt 
     * should wait at least the specified number of seconds.
     */
    it('should respect Retry-After header on 429 responses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            url: fc.webUrl(),
            retryAfterSeconds: fc.integer({ min: 1, max: 3 }), // Keep short for tests
          }),
          async ({ url, retryAfterSeconds }) => {
            const mockError: Partial<AxiosError> = {
              response: {
                status: 429,
                statusText: 'Too Many Requests',
                data: {},
                headers: {
                  'retry-after': retryAfterSeconds.toString(),
                },
                config: {} as any,
              },
              config: {} as any,
              isAxiosError: true,
              toJSON: () => ({}),
              name: 'AxiosError',
              message: 'Request failed with status code 429',
            };

            const mockSuccess: AxiosResponse = {
              data: { success: true },
              status: 200,
              statusText: 'OK',
              headers: {},
              config: {} as any,
            };

            jest.spyOn(httpService, 'get')
              .mockReturnValueOnce(throwError(() => mockError))
              .mockReturnValueOnce(of(mockSuccess));

            const startTime = Date.now();
            const result = await service.get(url);
            const duration = Date.now() - startTime;

            // Should succeed after retry
            expect(result).toEqual({ success: true });

            // Should have waited at least retryAfterSeconds
            const expectedWaitMs = retryAfterSeconds * 1000;
            expect(duration).toBeGreaterThanOrEqual(expectedWaitMs * 0.9); // Allow 10% margin
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should use exponential backoff when Retry-After header is missing on 429', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (url) => {
            const mockError: Partial<AxiosError> = {
              response: {
                status: 429,
                statusText: 'Too Many Requests',
                data: {},
                headers: {}, // No Retry-After header
                config: {} as any,
              },
              config: {} as any,
              isAxiosError: true,
              toJSON: () => ({}),
              name: 'AxiosError',
              message: 'Request failed with status code 429',
            };

            const mockSuccess: AxiosResponse = {
              data: { success: true },
              status: 200,
              statusText: 'OK',
              headers: {},
              config: {} as any,
            };

            jest.spyOn(httpService, 'get')
              .mockReturnValueOnce(throwError(() => mockError))
              .mockReturnValueOnce(of(mockSuccess));

            const startTime = Date.now();
            const result = await service.get(url);
            const duration = Date.now() - startTime;

            // Should succeed after retry
            expect(result).toEqual({ success: true });

            // Should have waited with exponential backoff (100ms * 2^0 = 100ms)
            expect(duration).toBeGreaterThanOrEqual(90); // Allow 10% margin
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });

  describe('Property 14: User-Agent header presence', () => {
    /**
     * **Validates: Requirements 6.6**
     * 
     * For any HTTP request, the request should include a User-Agent header 
     * with a value from the predefined list.
     */
    it('should include User-Agent header in all GET requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.webUrl(),
          async (url) => {
            const mockResponse: AxiosResponse = {
              data: { success: true },
              status: 200,
              statusText: 'OK',
              headers: {},
              config: {} as any,
            };

            const getSpy = jest.spyOn(httpService, 'get')
              .mockReturnValue(of(mockResponse));

            await service.get(url);

            // Verify User-Agent header was included
            const callArgs = getSpy.mock.calls[0];
            const config = callArgs[1];
            
            expect(config).toBeDefined();
            if (config) {
              expect(config.headers).toBeDefined();
              if (config.headers) {
                expect(config.headers['User-Agent']).toBeDefined();
                expect(typeof config.headers['User-Agent']).toBe('string');
                expect(config.headers['User-Agent'].length).toBeGreaterThan(0);
                
                // Verify it looks like a valid User-Agent string
                expect(config.headers['User-Agent']).toMatch(/Mozilla/);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include User-Agent header in all POST requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            url: fc.webUrl(),
            data: fc.object(),
          }),
          async ({ url, data }) => {
            const mockResponse: AxiosResponse = {
              data: { success: true },
              status: 200,
              statusText: 'OK',
              headers: {},
              config: {} as any,
            };

            const postSpy = jest.spyOn(httpService, 'post')
              .mockReturnValue(of(mockResponse));

            await service.post(url, data);

            // Verify User-Agent header was included
            const callArgs = postSpy.mock.calls[0];
            const config = callArgs[2];
            
            expect(config).toBeDefined();
            if (config) {
              expect(config.headers).toBeDefined();
              if (config.headers) {
                expect(config.headers['User-Agent']).toBeDefined();
                expect(typeof config.headers['User-Agent']).toBe('string');
                expect(config.headers['User-Agent'].length).toBeGreaterThan(0);
                expect(config.headers['User-Agent']).toMatch(/Mozilla/);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should rotate User-Agent headers across multiple requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.webUrl(), { minLength: 10, maxLength: 20 }),
          async (urls) => {
            const mockResponse: AxiosResponse = {
              data: { success: true },
              status: 200,
              statusText: 'OK',
              headers: {},
              config: {} as any,
            };

            const getSpy = jest.spyOn(httpService, 'get')
              .mockReturnValue(of(mockResponse));

            const userAgents = new Set<string>();

            // Make multiple requests
            for (const url of urls) {
              await service.get(url);
              const callArgs = getSpy.mock.calls[getSpy.mock.calls.length - 1];
              const config = callArgs[1];
              if (config && config.headers && config.headers['User-Agent']) {
                userAgents.add(config.headers['User-Agent']);
              }
            }

            // Should have used at least 2 different User-Agent strings
            // (with high probability for 10+ requests)
            expect(userAgents.size).toBeGreaterThanOrEqual(2);
          }
        ),
        { numRuns: 50 } // Fewer runs since this test makes many requests
      );
    });
  });

  describe('Property 15: Sensitive header exclusion from logs', () => {
    /**
     * **Validates: Requirements 6.7, 14.6**
     * 
     * For any failed HTTP request log entry, the log should not contain 
     * Authorization, Cookie, or other sensitive headers.
     */
    it('should redact sensitive headers in error logs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            url: fc.webUrl(),
            sensitiveHeader: fc.constantFrom(
              'authorization',
              'cookie',
              'set-cookie',
              'x-api-key',
              'api-key',
              'token',
              'x-auth-token',
              'x-csrf-token'
            ),
            sensitiveValue: fc.string({ minLength: 10, maxLength: 50 }),
            statusCode: fc.integer({ min: 500, max: 599 }),
          }),
          async ({ url, sensitiveHeader, sensitiveValue, statusCode }) => {
            const mockError: Partial<AxiosError> = {
              response: {
                status: statusCode,
                statusText: 'Server Error',
                data: {},
                headers: {
                  'content-type': 'application/json',
                  [sensitiveHeader]: sensitiveValue,
                },
                config: {} as any,
              },
              config: {
                headers: {
                  'user-agent': 'test',
                  [sensitiveHeader]: sensitiveValue,
                } as any,
              } as any,
              isAxiosError: true,
              toJSON: () => ({}),
              name: 'AxiosError',
              message: `Request failed with status code ${statusCode}`,
            };

            jest.spyOn(httpService, 'get')
              .mockReturnValue(throwError(() => mockError));

            const loggerSpy = jest.spyOn(service['logger'], 'error');

            try {
              await service.get(url);
            } catch (error) {
              // Expected to throw
            }

            // Verify logger was called
            expect(loggerSpy).toHaveBeenCalled();

            // Get the logged data
            const loggedData = loggerSpy.mock.calls[0][1];

            // Verify sensitive headers are redacted
            if (loggedData.responseHeaders && loggedData.responseHeaders[sensitiveHeader]) {
              expect(loggedData.responseHeaders[sensitiveHeader]).toBe('[REDACTED]');
              expect(loggedData.responseHeaders[sensitiveHeader]).not.toBe(sensitiveValue);
            }

            if (loggedData.requestHeaders && loggedData.requestHeaders[sensitiveHeader]) {
              expect(loggedData.requestHeaders[sensitiveHeader]).toBe('[REDACTED]');
              expect(loggedData.requestHeaders[sensitiveHeader]).not.toBe(sensitiveValue);
            }

            // Verify non-sensitive headers are preserved
            if (loggedData.responseHeaders) {
              expect(loggedData.responseHeaders['content-type']).toBe('application/json');
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should handle case-insensitive sensitive header matching', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            url: fc.webUrl(),
            headerCase: fc.constantFrom(
              'Authorization',
              'AUTHORIZATION',
              'authorization',
              'Cookie',
              'COOKIE',
              'cookie'
            ),
            sensitiveValue: fc.string({ minLength: 10, maxLength: 50 }),
          }),
          async ({ url, headerCase, sensitiveValue }) => {
            const mockError: Partial<AxiosError> = {
              response: {
                status: 500,
                statusText: 'Server Error',
                data: {},
                headers: {
                  [headerCase]: sensitiveValue,
                },
                config: {} as any,
              },
              config: {} as any,
              isAxiosError: true,
              toJSON: () => ({}),
              name: 'AxiosError',
              message: 'Request failed with status code 500',
            };

            jest.spyOn(httpService, 'get')
              .mockReturnValue(throwError(() => mockError));

            const loggerSpy = jest.spyOn(service['logger'], 'error');

            try {
              await service.get(url);
            } catch (error) {
              // Expected to throw
            }

            // Get the logged data
            const loggedData = loggerSpy.mock.calls[0][1];

            // Verify sensitive header is redacted regardless of case
            if (loggedData.responseHeaders && loggedData.responseHeaders[headerCase]) {
              expect(loggedData.responseHeaders[headerCase]).toBe('[REDACTED]');
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);
  });

  describe('Property 16: JSON response parsing', () => {
    /**
     * **Validates: Requirements 6.8**
     * 
     * For any HTTP response with valid JSON content, the get and post methods 
     * should return the parsed JavaScript object.
     */
    it('should parse JSON responses from GET requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            url: fc.webUrl(),
            responseData: fc.oneof(
              fc.object(),
              fc.array(fc.object()),
              fc.record({
                id: fc.integer(),
                name: fc.string(),
                active: fc.boolean(),
              }),
              fc.record({
                items: fc.array(fc.string()),
                count: fc.integer(),
                metadata: fc.object(),
              }),
            ),
          }),
          async ({ url, responseData }) => {
            const mockResponse: AxiosResponse = {
              data: responseData,
              status: 200,
              statusText: 'OK',
              headers: {
                'content-type': 'application/json',
              },
              config: {} as any,
            };

            jest.spyOn(httpService, 'get')
              .mockReturnValue(of(mockResponse));

            const result = await service.get(url);

            // Should return the parsed JSON data
            expect(result).toEqual(responseData);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should parse JSON responses from POST requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            url: fc.webUrl(),
            requestData: fc.object(),
            responseData: fc.oneof(
              fc.object(),
              fc.record({
                success: fc.boolean(),
                message: fc.string(),
                data: fc.object(),
              }),
            ),
          }),
          async ({ url, requestData, responseData }) => {
            const mockResponse: AxiosResponse = {
              data: responseData,
              status: 201,
              statusText: 'Created',
              headers: {
                'content-type': 'application/json',
              },
              config: {} as any,
            };

            jest.spyOn(httpService, 'post')
              .mockReturnValue(of(mockResponse));

            const result = await service.post(url, requestData);

            // Should return the parsed JSON data
            expect(result).toEqual(responseData);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle various JSON data types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            url: fc.webUrl(),
            responseData: fc.oneof(
              fc.string(),
              fc.integer(),
              fc.boolean(),
              fc.constant(null),
              fc.array(fc.anything()),
              fc.object(),
            ),
          }),
          async ({ url, responseData }) => {
            const mockResponse: AxiosResponse = {
              data: responseData,
              status: 200,
              statusText: 'OK',
              headers: {
                'content-type': 'application/json',
              },
              config: {} as any,
            };

            jest.spyOn(httpService, 'get')
              .mockReturnValue(of(mockResponse));

            const result = await service.get(url);

            // Should return the exact data
            expect(result).toEqual(responseData);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve nested object structures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            url: fc.webUrl(),
            responseData: fc.record({
              level1: fc.record({
                level2: fc.record({
                  level3: fc.record({
                    value: fc.string(),
                    numbers: fc.array(fc.integer()),
                  }),
                }),
              }),
            }),
          }),
          async ({ url, responseData }) => {
            const mockResponse: AxiosResponse = {
              data: responseData,
              status: 200,
              statusText: 'OK',
              headers: {
                'content-type': 'application/json',
              },
              config: {} as any,
            };

            jest.spyOn(httpService, 'get')
              .mockReturnValue(of(mockResponse));

            const result = await service.get(url);

            // Should preserve nested structure
            expect(result).toEqual(responseData);
            expect(result.level1.level2.level3.value).toBe(responseData.level1.level2.level3.value);
            expect(result.level1.level2.level3.numbers).toEqual(responseData.level1.level2.level3.numbers);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
