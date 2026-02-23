/**
 * E2E tests for API compatibility layer.
 * Uses a minimal app with only API routes and mock providers (no DB/Redis).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpModule } from '@nestjs/axios';
import { ApiKeyGuard } from '../src/common/guards/api-key.guard';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ApiLoggingInterceptor } from '../src/common/interceptors/api-logging.interceptor';
import { HealthController } from '../src/modules/health/health.controller';
import { MarketContentApiController } from '../src/modules/market-content/market-content-api.controller';
import { MarketContentApiService } from '../src/modules/market-content/market-content-api.service';
import { MarketPricingApiController } from '../src/modules/market-pricing/market-pricing-api.controller';
import { MarketPricingApiService } from '../src/modules/market-pricing/market-pricing-api.service';
import { StockApiController } from '../src/modules/market-company/stock-api.controller';
import { StockApiService } from '../src/modules/market-company/stock-api.service';
import { SStockProxyController } from '../src/modules/market-company/sstock-proxy.controller';
import { SStockProxyService } from '../src/modules/market-company/sstock-proxy.service';
import { MarketRecommendationApiController } from '../src/modules/market-recommendation/market-recommendation-api.controller';
import { MarketRecommendationApiService } from '../src/modules/market-recommendation/market-recommendation-api.service';
import { MarketReportingApiController } from '../src/modules/market-reporting/market-reporting-api.controller';
import { MarketReportingApiService } from '../src/modules/market-reporting/market-reporting-api.service';
import { AiCrawlerProvider } from '../src/modules/api-compatibility/providers/ai-crawler.provider';
import { VnStockProvider } from '../src/modules/api-compatibility/providers/vnstock.provider';
import { SStockApiProvider } from '../src/modules/api-compatibility/providers/sstock-api.provider';
import { CONTENT_PROVIDER } from '../src/modules/market-content/market-content-api.service';
import { PRICING_PROVIDER } from '../src/modules/market-pricing/market-pricing-api.service';
import { STOCK_PROVIDER } from '../src/modules/market-company/stock-api.service';
import { RECOMMENDATION_PROVIDER } from '../src/modules/market-recommendation/market-recommendation-api.service';
import { REPORTING_PROVIDER } from '../src/modules/market-reporting/market-reporting-api.service';

const E2E_API_KEY = 'e2e-test-api-key';

describe('API Compatibility (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.INTERNAL_API_KEY = E2E_API_KEY;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ INTERNAL_API_KEY: E2E_API_KEY })],
        }),
        CacheModule.register({ ttl: 60_000 }),
        HttpModule.register({ timeout: 5000 }),
      ],
      controllers: [
        HealthController,
        MarketContentApiController,
        MarketPricingApiController,
        StockApiController,
        SStockProxyController,
        MarketRecommendationApiController,
        MarketReportingApiController,
      ],
      providers: [
        { provide: APP_GUARD, useClass: ApiKeyGuard },
        MarketContentApiService,
        { provide: CONTENT_PROVIDER, useClass: AiCrawlerProvider },
        MarketPricingApiService,
        { provide: PRICING_PROVIDER, useClass: VnStockProvider },
        StockApiService,
        SStockProxyService,
        { provide: STOCK_PROVIDER, useClass: SStockApiProvider },
        MarketRecommendationApiService,
        { provide: RECOMMENDATION_PROVIDER, useClass: SStockApiProvider },
        MarketReportingApiService,
        { provide: REPORTING_PROVIDER, useClass: AiCrawlerProvider },
        AiCrawlerProvider,
        VnStockProvider,
        SStockApiProvider,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiLoggingInterceptor());

    await app.init();
  }, 15_000);

  afterAll(async () => {
    await app?.close();
  });

  describe('Public routes (no x-api-key)', () => {
    it('GET /health returns 200', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body?.status).toBe('ok');
        });
    });

    it('GET /api/health returns 200', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body?.status).toBe('ok');
        });
    });
  });

  describe('Protected routes require x-api-key', () => {
    it('GET /api/articles without key returns 401', () => {
      return request(app.getHttpServer()).get('/api/articles').expect(401);
    });

    it('GET /api/articles with key returns non-401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/articles')
        .set('x-api-key', E2E_API_KEY);
      expect(res.status).not.toBe(401);
    });

    it('POST /api/marketboard/index-quote with key returns non-401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/marketboard/index-quote')
        .set('x-api-key', E2E_API_KEY)
        .set('Content-Type', 'application/json')
        .send({});
      expect(res.status).not.toBe(401);
    });

    it('GET /api/sstock with key and path returns non-401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/sstock')
        .query({ path: '/api/v1/company/all' })
        .set('x-api-key', E2E_API_KEY);
      expect(res.status).not.toBe(401);
    });

    it('GET /api/sstock without path returns 200 with error body', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/sstock')
        .set('x-api-key', E2E_API_KEY);
      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(false);
      expect(res.body?.error).toBe('BAD_REQUEST');
    });

    it('GET /api/watchlists with key returns non-401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/watchlists')
        .set('x-api-key', E2E_API_KEY);
      expect(res.status).not.toBe(401);
    });

    it('GET /api/alerts with key returns non-401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/alerts')
        .set('x-api-key', E2E_API_KEY);
      expect(res.status).not.toBe(401);
    });

    it('GET /api/payment/check-success/:txnRef with key returns non-401', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/payment/check-success/sample-txn-ref')
        .set('x-api-key', E2E_API_KEY);
      expect(res.status).not.toBe(401);
    });
  });
});
