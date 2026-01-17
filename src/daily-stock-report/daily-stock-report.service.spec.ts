import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DailyStockReportService } from './daily-stock-report.service';
import { DailyStockReportEntity, InvestmentRecommendation } from './daily-stock-report.entity';
import { QueueService } from '../queue/queue.service';

describe('DailyStockReportService', () => {
  let service: DailyStockReportService;
  let mockRepository: any;

  const mockReport: Partial<DailyStockReportEntity> = {
    id: 'test-uuid',
    stock: 'VNM',
    reportDate: new Date('2025-01-12'),
    url: 'https://example.com/report.pdf',
    pdfUrl: null,
    investmentRecommendation: InvestmentRecommendation.BUY,
  };

  beforeEach(async () => {
    mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockQueueService = {
      addGenerateStockReportJob: jest.fn(),
      addTemplateEmailJob: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyStockReportService,
        {
          provide: getRepositoryToken(DailyStockReportEntity),
          useValue: mockRepository,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    service = module.get<DailyStockReportService>(DailyStockReportService);
  });

  describe('getLatestByStockCode', () => {
    it('should return the latest report for a valid stock code', async () => {
      mockRepository.findOne.mockResolvedValue(mockReport);

      const result = await service.getLatestByStockCode('vnm');

      expect(result).toEqual({
        stockCode: 'VNM',
        reportDate: '2025-01-12',
        pdfUrl: 'https://example.com/report.pdf',
        investmentRecommendation: 'Mua',
      });

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { stock: 'VNM' },
        order: { reportDate: 'DESC', createdAt: 'DESC' },
        select: ['stock', 'reportDate', 'url', 'pdfUrl', 'investmentRecommendation'],
      });
    });

    it('should normalize stock code (trim and uppercase)', async () => {
      mockRepository.findOne.mockResolvedValue(mockReport);

      await service.getLatestByStockCode('  vnm  ');

      expect(mockRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stock: 'VNM' },
        }),
      );
    });

    it('should throw NotFoundException when no report exists', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getLatestByStockCode('INVALID')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for empty stock code', async () => {
      await expect(service.getLatestByStockCode('   ')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should prefer pdfUrl over url when both exist', async () => {
      const reportWithBothUrls = {
        ...mockReport,
        pdfUrl: 'https://example.com/preferred.pdf',
        url: 'https://example.com/fallback.pdf',
      };
      mockRepository.findOne.mockResolvedValue(reportWithBothUrls);

      const result = await service.getLatestByStockCode('VNM');

      expect(result.pdfUrl).toBe('https://example.com/preferred.pdf');
    });

    it('should return null for investmentRecommendation when not set', async () => {
      const reportWithoutRecommendation = {
        ...mockReport,
        investmentRecommendation: null,
      };
      mockRepository.findOne.mockResolvedValue(reportWithoutRecommendation);

      const result = await service.getLatestByStockCode('VNM');

      expect(result.investmentRecommendation).toBeNull();
    });
  });

  describe('getOrCreateToday', () => {
    let mockQueueService: any;
    let mockQueryBuilder: any;

    beforeEach(async () => {
      mockQueueService = {
        addGenerateStockReportJob: jest.fn(),
        addTemplateEmailJob: jest.fn(),
      };

      mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      };

      mockRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DailyStockReportService,
          {
            provide: getRepositoryToken(DailyStockReportEntity),
            useValue: mockRepository,
          },
          {
            provide: QueueService,
            useValue: mockQueueService,
          },
        ],
      }).compile();

      service = module.get<DailyStockReportService>(DailyStockReportService);
    });

    it('should return existing report with READY status when pdfUrl exists', async () => {
      const existingReportWithUrl = {
        id: 'test-uuid',
        stock: 'VNM',
        reportDate: new Date('2026-01-12'),
        url: 'https://example.com/report.pdf',
        pdfUrl: null,
        investmentRecommendation: InvestmentRecommendation.BUY,
      };
      mockQueryBuilder.getOne.mockResolvedValue(existingReportWithUrl);

      const result = await service.getOrCreateToday('vnm');

      expect(result.status).toBe('READY');
      expect(result.pdfUrl).toBe('https://example.com/report.pdf');
      expect(mockQueueService.addGenerateStockReportJob).not.toHaveBeenCalled();
    });

    it('should return existing report with PENDING status when pdfUrl is null', async () => {
      const placeholderReport = {
        id: 'test-uuid',
        stock: 'VNM',
        reportDate: new Date('2026-01-12'),
        url: null,
        pdfUrl: null,
        investmentRecommendation: null,
      };
      mockQueryBuilder.getOne.mockResolvedValue(placeholderReport);

      const result = await service.getOrCreateToday('vnm');

      expect(result.status).toBe('PENDING');
      expect(result.pdfUrl).toBeNull();
      expect(mockQueueService.addGenerateStockReportJob).not.toHaveBeenCalled();
    });

    it('should create placeholder and enqueue job when no report exists', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);
      const placeholder = {
        id: 'new-uuid',
        stock: 'VNM',
        reportDate: new Date(),
        url: null,
      };
      mockRepository.create.mockReturnValue(placeholder);
      mockRepository.save.mockResolvedValue(placeholder);

      const result = await service.getOrCreateToday('vnm');

      expect(result.status).toBe('PENDING');
      expect(result.pdfUrl).toBeNull();
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(mockQueueService.addGenerateStockReportJob).toHaveBeenCalledWith('VNM');
    });

    it('should normalize stock code (trim and uppercase)', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);
      const placeholder = { id: 'new-uuid', stock: 'VNM', reportDate: new Date(), url: null };
      mockRepository.create.mockReturnValue(placeholder);
      mockRepository.save.mockResolvedValue(placeholder);

      await service.getOrCreateToday('  vnm  ');

      expect(mockQueueService.addGenerateStockReportJob).toHaveBeenCalledWith('VNM');
    });

    it('should throw NotFoundException for empty stock code', async () => {
      await expect(service.getOrCreateToday('   ')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should ensure idempotency - repeated calls same day do not enqueue duplicates', async () => {
      const placeholderReport = {
        id: 'test-uuid',
        stock: 'VNM',
        reportDate: new Date(),
        url: null,
        pdfUrl: null,
        investmentRecommendation: null,
      };
      mockQueryBuilder.getOne.mockResolvedValue(placeholderReport);

      await service.getOrCreateToday('vnm');
      await service.getOrCreateToday('vnm');

      expect(mockQueueService.addGenerateStockReportJob).not.toHaveBeenCalled();
    });
  });
});
