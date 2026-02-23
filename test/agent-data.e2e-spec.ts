/**
 * E2E tests for Agent API (api/agent/*): 401 without x-api-key, 200 shape with key.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeyGuard } from '../src/common/guards/api-key.guard';
import { AgentDataController } from '../src/modules/agent-data/agent-data.controller';
import { AgentDataService } from '../src/modules/agent-data/agent-data.service';

const E2E_API_KEY = 'e2e-agent-api-key';

describe('Agent Data API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.INTERNAL_API_KEY = E2E_API_KEY;

    const stubService = {
      getQuote: jest.fn().mockResolvedValue({ data: {}, meta: { source: 'local', storage: 'db' } }),
      getHistory: jest.fn().mockResolvedValue({ data: [], meta: { source: 'local', storage: 'db' } }),
      getFundamentals: jest.fn().mockResolvedValue({ data: {}, meta: { source: 'local', storage: 'db' } }),
      getStatements: jest.fn().mockResolvedValue({ data: [], meta: { source: 'local', storage: 'db' } }),
      getNews: jest.fn().mockResolvedValue({ data: [], meta: { source: 'local', storage: 'db' } }),
      getGlobalNews: jest.fn().mockResolvedValue({ data: [], meta: { source: 'local', storage: 'db' } }),
      getInsiderSentiment: jest.fn().mockResolvedValue({ data: {}, meta: { source: 'local', storage: 'db' } }),
      getInsiderTransactions: jest.fn().mockResolvedValue({ data: [], meta: { source: 'local', storage: 'db' } }),
      getIndexSummary: jest.fn().mockResolvedValue({ data: {}, meta: { source: 'local', storage: 'db' } }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ INTERNAL_API_KEY: E2E_API_KEY })],
        }),
      ],
      controllers: [AgentDataController],
      providers: [
        { provide: APP_GUARD, useClass: ApiKeyGuard },
        { provide: AgentDataService, useValue: stubService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 15_000);

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/agent/quote/VNM without x-api-key returns 401', () => {
    return request(app.getHttpServer()).get('/api/agent/quote/VNM').expect(401);
  });

  it('GET /api/agent/quote/VNM with x-api-key returns 200 and meta.source=local', () => {
    return request(app.getHttpServer())
      .get('/api/agent/quote/VNM')
      .set('x-api-key', E2E_API_KEY)
      .expect(200)
      .expect((res) => {
        expect(res.body?.meta?.source).toBe('local');
        expect(['db', 'live_fallback']).toContain(res.body?.meta?.storage);
      });
  });

  it('GET /api/agent/index-summary/UPCOM with x-api-key returns 200', () => {
    return request(app.getHttpServer())
      .get('/api/agent/index-summary/UPCOM')
      .set('x-api-key', E2E_API_KEY)
      .expect(200)
      .expect((res) => {
        expect(res.body?.meta?.source).toBe('local');
      });
  });
});
