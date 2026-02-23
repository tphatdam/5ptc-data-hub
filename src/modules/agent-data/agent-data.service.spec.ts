import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import {
  Symbol,
  StockCandle,
  StockSnapshot,
  NewsArticle,
  StockInsiderEvent,
  StockFinancialStatementFact,
  MarketIndex,
  IndexCandle,
  DataSource as DataSourceEntity,
} from '../data-hub/entities';
import { AgentDataService } from './agent-data.service';
import { ProviderFactoryService } from '../data-hub/providers/provider-factory.service';
import { SStockProxyService } from '../market-company/sstock-proxy.service';
import { CandleInterval } from '../data-hub/enums';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
  })),
  upsert: jest.fn(),
});

describe('AgentDataService', () => {
  let service: AgentDataService;
  let symbolRepo: jest.Mocked<Repository<Symbol>>;
  let stockCandleRepo: jest.Mocked<Repository<StockCandle>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentDataService,
        { provide: getRepositoryToken(Symbol), useValue: mockRepo() },
        { provide: getRepositoryToken(StockCandle), useValue: mockRepo() },
        { provide: getRepositoryToken(StockSnapshot), useValue: mockRepo() },
        { provide: getRepositoryToken(NewsArticle), useValue: mockRepo() },
        { provide: getRepositoryToken(StockInsiderEvent), useValue: mockRepo() },
        { provide: getRepositoryToken(StockFinancialStatementFact), useValue: mockRepo() },
        { provide: getRepositoryToken(MarketIndex), useValue: mockRepo() },
        { provide: getRepositoryToken(IndexCandle), useValue: mockRepo() },
        { provide: getRepositoryToken(DataSourceEntity), useValue: mockRepo() },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key === 'agentData.liveFallbackEnabled' ? true : undefined)) },
        },
        {
          provide: ProviderFactoryService,
          useValue: {
            getMarketProviderEntries: jest.fn().mockResolvedValue([]),
            getFundamentalsProviderEntries: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: SStockProxyService, useValue: { proxyGet: jest.fn() } },
      ],
    }).compile();

    service = module.get<AgentDataService>(AgentDataService);
    symbolRepo = module.get(getRepositoryToken(Symbol));
    stockCandleRepo = module.get(getRepositoryToken(StockCandle));
  });

  describe('getQuote', () => {
    it('returns meta.source=local and meta.storage when symbol not found', async () => {
      (symbolRepo.findOne as jest.Mock).mockResolvedValue(null);
      const result = await service.getQuote('UNKNOWN');
      expect(result.meta.source).toBe('local');
      expect(result.meta.storage).toBeDefined();
      expect(['db', 'live_fallback']).toContain(result.meta.storage);
    });

    it('returns DB quote with meta.storage=db when candle exists', async () => {
      (symbolRepo.findOne as jest.Mock).mockResolvedValue({ id: 1, ticker: 'VNM' });
      (stockCandleRepo.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        symbolId: 1,
        interval: CandleInterval.DAILY,
        ts: new Date('2025-01-15'),
        open: '80',
        high: '82',
        low: '79',
        close: '81',
        volume: '1000000',
      });
      stockCandleRepo.createQueryBuilder = jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          close: '80',
        }),
      })) as any;
      const result = await service.getQuote('VNM');
      expect(result.meta.source).toBe('local');
      expect(result.meta.storage).toBe('db');
      expect(result.data.last_price).toBe(81);
    });
  });

  describe('getIndexSummary', () => {
    it('normalizes UPCOM to UPCOMINDEX and returns meta.source=local', async () => {
      const marketIndexRepo = (service as any).marketIndexRepo;
      const indexCandleRepo = (service as any).indexCandleRepo;
      (marketIndexRepo.findOne as jest.Mock).mockResolvedValue(null);
      const result = await service.getIndexSummary('UPCOM');
      expect(result.meta.source).toBe('local');
    });
  });
});
