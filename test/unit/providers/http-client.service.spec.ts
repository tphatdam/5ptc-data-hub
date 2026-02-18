import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { HttpClientService } from '../../../src/modules/providers/http-client.service';
import { of, throwError } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';

describe('HttpClientService', () => {
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
                'http.timeoutMs': 30000,
                'http.retries': 3,
                'http.retryBaseMs': 1000,
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should successfully perform a GET request', async () => {
      const mockData = { message: 'success' };
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      const result = await service.get('https://example.com/api');

      expect(result).toEqual(mockData);
      expect(httpService.get).toHaveBeenCalledWith(
        'https://example.com/api',
        expect.objectContaining({
          timeout: 30000,
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
          }),
        }),
      );
    });

    it('should include User-Agent header in requests', async () => {
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      await service.get('https://example.com/api');

      const callArgs = (httpService.get as jest.Mock).mock.calls[0];
      const config = callArgs[1];

      expect(config.headers['User-Agent']).toBeDefined();
      expect(typeof config.headers['User-Agent']).toBe('string');
      expect(config.headers['User-Agent'].length).toBeGreaterThan(0);
    });

    it('should apply timeout from configuration', async () => {
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockResponse));

      await service.get('https://example.com/api');

      const callArgs = (httpService.get as jest.Mock).mock.calls[0];
      const config = callArgs[1];

      expect(config.timeout).toBe(30000);
    });
  });

  describe('post', () => {
    it('should successfully perform a POST request', async () => {
      const mockData = { id: 1, created: true };
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

      const postData = { name: 'test' };
      const result = await service.post('https://example.com/api', postData);

      expect(result).toEqual(mockData);
      expect(httpService.post).toHaveBeenCalledWith(
        'https://example.com/api',
        postData,
        expect.objectContaining({
          timeout: 30000,
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
          }),
        }),
      );
    });
  });

  describe('retry logic', () => {
    it('should retry on 5xx errors', async () => {
      const mockError: Partial<AxiosError> = {
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: {},
          headers: {},
          config: {} as any,
        },
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 500',
      };

      const mockResponse: AxiosResponse = {
        data: { message: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      // Fail twice, then succeed
      jest
        .spyOn(httpService, 'get')
        .mockReturnValueOnce(throwError(() => mockError))
        .mockReturnValueOnce(throwError(() => mockError))
        .mockReturnValueOnce(of(mockResponse));

      const result = await service.get('https://example.com/api');

      expect(result).toEqual({ message: 'success' });
      expect(httpService.get).toHaveBeenCalledTimes(3);
    });

    it('should retry on 429 rate limit errors', async () => {
      const mockError: Partial<AxiosError> = {
        response: {
          status: 429,
          statusText: 'Too Many Requests',
          data: {},
          headers: {},
          config: {} as any,
        },
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 429',
      };

      const mockResponse: AxiosResponse = {
        data: { message: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest
        .spyOn(httpService, 'get')
        .mockReturnValueOnce(throwError(() => mockError))
        .mockReturnValueOnce(of(mockResponse));

      const result = await service.get('https://example.com/api');

      expect(result).toEqual({ message: 'success' });
      expect(httpService.get).toHaveBeenCalledTimes(2);
    });

    it('should respect Retry-After header on 429 responses', async () => {
      const mockError: Partial<AxiosError> = {
        response: {
          status: 429,
          statusText: 'Too Many Requests',
          data: {},
          headers: {
            'retry-after': '2', // 2 seconds
          },
          config: {} as any,
        },
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 429',
      };

      const mockResponse: AxiosResponse = {
        data: { message: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest
        .spyOn(httpService, 'get')
        .mockReturnValueOnce(throwError(() => mockError))
        .mockReturnValueOnce(of(mockResponse));

      const startTime = Date.now();
      const result = await service.get('https://example.com/api');
      const duration = Date.now() - startTime;

      expect(result).toEqual({ message: 'success' });
      // Should wait at least 2 seconds (2000ms) due to Retry-After header
      expect(duration).toBeGreaterThanOrEqual(1900); // Allow small margin
    });

    it('should not retry on 4xx client errors (except 429)', async () => {
      const mockError: Partial<AxiosError> = {
        response: {
          status: 404,
          statusText: 'Not Found',
          data: {},
          headers: {},
          config: {} as any,
        },
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'Request failed with status code 404',
      };

      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError));

      try {
        await service.get('https://example.com/api');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Should only try once (no retries for 404)
      expect(httpService.get).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      const mockError: Partial<AxiosError> = {
        code: 'ECONNREFUSED',
        config: {} as any,
        isAxiosError: true,
        toJSON: () => ({}),
        name: 'AxiosError',
        message: 'connect ECONNREFUSED',
      };

      const mockResponse: AxiosResponse = {
        data: { message: 'success' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest
        .spyOn(httpService, 'get')
        .mockReturnValueOnce(throwError(() => mockError))
        .mockReturnValueOnce(of(mockResponse));

      const result = await service.get('https://example.com/api');

      expect(result).toEqual({ message: 'success' });
      expect(httpService.get).toHaveBeenCalledTimes(2);
    });

    it(
      'should throw error after max retries exhausted',
      async () => {
        const mockError: Partial<AxiosError> = {
          response: {
            status: 500,
            statusText: 'Internal Server Error',
            data: {},
            headers: {},
            config: {} as any,
          },
          config: {} as any,
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Request failed with status code 500',
        };

        jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError));

        try {
          await service.get('https://example.com/api');
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeDefined();
        }

        // Should try 4 times total (1 initial + 3 retries)
        expect(httpService.get).toHaveBeenCalledTimes(4);
      },
      10000,
    ); // 10 second timeout for retry logic
  });

  describe('header sanitization', () => {
    it(
      'should sanitize sensitive headers in error logs',
      async () => {
        const mockError: Partial<AxiosError> = {
          response: {
            status: 500,
            statusText: 'Internal Server Error',
            data: {},
            headers: {
              'content-type': 'application/json',
              authorization: 'Bearer secret-token',
              cookie: 'session=abc123',
            },
            config: {} as any,
          },
          config: {
            headers: {
              'user-agent': 'test',
              'x-api-key': 'secret-key',
            } as any,
          } as any,
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Request failed with status code 500',
        };

        jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError));

        const loggerSpy = jest.spyOn(service['logger'], 'error');

        try {
          await service.get('https://example.com/api');
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeDefined();
        }

        // Verify logger was called
        expect(loggerSpy).toHaveBeenCalled();

        // Get the logged data
        const loggedData = loggerSpy.mock.calls[0][1];

        // Verify sensitive headers are redacted
        expect(loggedData.responseHeaders.authorization).toBe('[REDACTED]');
        expect(loggedData.responseHeaders.cookie).toBe('[REDACTED]');
        expect(loggedData.requestHeaders['x-api-key']).toBe('[REDACTED]');

        // Verify non-sensitive headers are preserved
        expect(loggedData.responseHeaders['content-type']).toBe('application/json');
      },
      10000,
    ); // 10 second timeout for retry logic
  });

  describe('edge cases', () => {
    describe('network timeout scenarios', () => {
      it('should retry on ETIMEDOUT network error', async () => {
        const mockError: Partial<AxiosError> = {
          code: 'ETIMEDOUT',
          config: {} as any,
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'timeout of 30000ms exceeded',
        };

        const mockResponse: AxiosResponse = {
          data: { message: 'success' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        jest
          .spyOn(httpService, 'get')
          .mockReturnValueOnce(throwError(() => mockError))
          .mockReturnValueOnce(of(mockResponse));

        const result = await service.get('https://example.com/api');

        expect(result).toEqual({ message: 'success' });
        expect(httpService.get).toHaveBeenCalledTimes(2);
      });

      it('should retry on ECONNABORTED (axios timeout)', async () => {
        const mockError: Partial<AxiosError> = {
          code: 'ECONNABORTED',
          config: {} as any,
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'timeout of 30000ms exceeded',
        };

        const mockResponse: AxiosResponse = {
          data: { message: 'success' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        jest
          .spyOn(httpService, 'get')
          .mockReturnValueOnce(throwError(() => mockError))
          .mockReturnValueOnce(of(mockResponse));

        const result = await service.get('https://example.com/api');

        expect(result).toEqual({ message: 'success' });
        expect(httpService.get).toHaveBeenCalledTimes(2);
      });

      it(
        'should exhaust retries on persistent timeout',
        async () => {
          const mockError: Partial<AxiosError> = {
            code: 'ETIMEDOUT',
            config: {} as any,
            isAxiosError: true,
            toJSON: () => ({}),
            name: 'AxiosError',
            message: 'timeout of 30000ms exceeded',
          };

          jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError));

          try {
            await service.get('https://example.com/api');
            fail('Should have thrown an error');
          } catch (error) {
            expect(error).toBeDefined();
            expect((error as AxiosError).code).toBe('ETIMEDOUT');
          }

          // Should try 4 times total (1 initial + 3 retries)
          expect(httpService.get).toHaveBeenCalledTimes(4);
        },
        10000,
      );
    });

    describe('429 rate limit edge cases', () => {
      it('should use exponential backoff when 429 has no Retry-After header', async () => {
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

        const mockResponse: AxiosResponse = {
          data: { message: 'success' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        jest
          .spyOn(httpService, 'get')
          .mockReturnValueOnce(throwError(() => mockError))
          .mockReturnValueOnce(of(mockResponse));

        const startTime = Date.now();
        const result = await service.get('https://example.com/api');
        const duration = Date.now() - startTime;

        expect(result).toEqual({ message: 'success' });
        // Should use exponential backoff (1000ms * 2^0 = 1000ms)
        expect(duration).toBeGreaterThanOrEqual(900); // Allow small margin
        expect(duration).toBeLessThan(3000); // Should not wait too long
      });

      it('should handle invalid Retry-After header gracefully', async () => {
        const mockError: Partial<AxiosError> = {
          response: {
            status: 429,
            statusText: 'Too Many Requests',
            data: {},
            headers: {
              'retry-after': 'invalid-value', // Invalid value
            },
            config: {} as any,
          },
          config: {} as any,
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Request failed with status code 429',
        };

        const mockResponse: AxiosResponse = {
          data: { message: 'success' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };

        jest
          .spyOn(httpService, 'get')
          .mockReturnValueOnce(throwError(() => mockError))
          .mockReturnValueOnce(of(mockResponse));

        const startTime = Date.now();
        const result = await service.get('https://example.com/api');
        const duration = Date.now() - startTime;

        expect(result).toEqual({ message: 'success' });
        // Should fall back to exponential backoff when Retry-After is invalid
        expect(duration).toBeGreaterThanOrEqual(900);
      });
    });

    describe('non-retryable 4xx errors', () => {
      it('should not retry on 400 Bad Request', async () => {
        const mockError: Partial<AxiosError> = {
          response: {
            status: 400,
            statusText: 'Bad Request',
            data: { error: 'Invalid input' },
            headers: {},
            config: {} as any,
          },
          config: {} as any,
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Request failed with status code 400',
        };

        jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError));

        try {
          await service.get('https://example.com/api');
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeDefined();
          expect((error as AxiosError).response?.status).toBe(400);
        }

        // Should only try once (no retries for 400)
        expect(httpService.get).toHaveBeenCalledTimes(1);
      });

      it('should not retry on 401 Unauthorized', async () => {
        const mockError: Partial<AxiosError> = {
          response: {
            status: 401,
            statusText: 'Unauthorized',
            data: { error: 'Invalid credentials' },
            headers: {},
            config: {} as any,
          },
          config: {} as any,
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Request failed with status code 401',
        };

        jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError));

        try {
          await service.get('https://example.com/api');
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeDefined();
          expect((error as AxiosError).response?.status).toBe(401);
        }

        expect(httpService.get).toHaveBeenCalledTimes(1);
      });

      it('should not retry on 403 Forbidden', async () => {
        const mockError: Partial<AxiosError> = {
          response: {
            status: 403,
            statusText: 'Forbidden',
            data: { error: 'Access denied' },
            headers: {},
            config: {} as any,
          },
          config: {} as any,
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Request failed with status code 403',
        };

        jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError));

        try {
          await service.get('https://example.com/api');
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeDefined();
          expect((error as AxiosError).response?.status).toBe(403);
        }

        expect(httpService.get).toHaveBeenCalledTimes(1);
      });

      it('should not retry on 422 Unprocessable Entity', async () => {
        const mockError: Partial<AxiosError> = {
          response: {
            status: 422,
            statusText: 'Unprocessable Entity',
            data: { error: 'Validation failed' },
            headers: {},
            config: {} as any,
          },
          config: {} as any,
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Request failed with status code 422',
        };

        jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError));

        try {
          await service.get('https://example.com/api');
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeDefined();
          expect((error as AxiosError).response?.status).toBe(422);
        }

        expect(httpService.get).toHaveBeenCalledTimes(1);
      });
    });

    describe('max retries exhaustion', () => {
      it(
        'should exhaust retries with exponential backoff timing',
        async () => {
          const mockError: Partial<AxiosError> = {
            response: {
              status: 503,
              statusText: 'Service Unavailable',
              data: {},
              headers: {},
              config: {} as any,
            },
            config: {} as any,
            isAxiosError: true,
            toJSON: () => ({}),
            name: 'AxiosError',
            message: 'Request failed with status code 503',
          };

          jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError));

          const startTime = Date.now();

          try {
            await service.get('https://example.com/api');
            fail('Should have thrown an error');
          } catch (error) {
            expect(error).toBeDefined();
          }

          const duration = Date.now() - startTime;

          // Should try 4 times total (1 initial + 3 retries)
          expect(httpService.get).toHaveBeenCalledTimes(4);

          // Total wait time should be approximately:
          // 1st retry: 1000ms * 2^0 = 1000ms
          // 2nd retry: 1000ms * 2^1 = 2000ms
          // 3rd retry: 1000ms * 2^2 = 4000ms
          // Total: ~7000ms
          expect(duration).toBeGreaterThanOrEqual(6500); // Allow margin
          expect(duration).toBeLessThan(9000); // Should not exceed significantly
        },
        15000,
      );

      it(
        'should log final failure after exhausting retries',
        async () => {
          const mockError: Partial<AxiosError> = {
            response: {
              status: 502,
              statusText: 'Bad Gateway',
              data: {},
              headers: {},
              config: {} as any,
            },
            config: {} as any,
            isAxiosError: true,
            toJSON: () => ({}),
            name: 'AxiosError',
            message: 'Request failed with status code 502',
          };

          jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => mockError));

          const loggerErrorSpy = jest.spyOn(service['logger'], 'error');
          const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');

          try {
            await service.get('https://example.com/api');
            fail('Should have thrown an error');
          } catch (error) {
            expect(error).toBeDefined();
          }

          // Should log warnings for retry attempts
          expect(loggerWarnSpy).toHaveBeenCalledTimes(3); // 3 retry attempts

          // Should log final error
          expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
          expect(loggerErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('HTTP request failed after'),
            expect.objectContaining({
              status: 502,
              method: 'GET',
            }),
          );
        },
        15000,
      );
    });

    describe('POST request edge cases', () => {
      it('should handle POST request timeout', async () => {
        const mockError: Partial<AxiosError> = {
          code: 'ETIMEDOUT',
          config: {} as any,
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'timeout of 30000ms exceeded',
        };

        const mockResponse: AxiosResponse = {
          data: { id: 1, created: true },
          status: 201,
          statusText: 'Created',
          headers: {},
          config: {} as any,
        };

        jest
          .spyOn(httpService, 'post')
          .mockReturnValueOnce(throwError(() => mockError))
          .mockReturnValueOnce(of(mockResponse));

        const postData = { name: 'test' };
        const result = await service.post('https://example.com/api', postData);

        expect(result).toEqual({ id: 1, created: true });
        expect(httpService.post).toHaveBeenCalledTimes(2);
      });

      it('should not retry POST on 400 error', async () => {
        const mockError: Partial<AxiosError> = {
          response: {
            status: 400,
            statusText: 'Bad Request',
            data: { error: 'Invalid data' },
            headers: {},
            config: {} as any,
          },
          config: {} as any,
          isAxiosError: true,
          toJSON: () => ({}),
          name: 'AxiosError',
          message: 'Request failed with status code 400',
        };

        jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => mockError));

        try {
          await service.post('https://example.com/api', { name: 'test' });
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeDefined();
        }

        expect(httpService.post).toHaveBeenCalledTimes(1);
      });
    });
  });
});
