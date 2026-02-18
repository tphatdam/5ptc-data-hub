import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SymbolsRepository } from '../../../src/modules/symbols/symbols.repository';
import { Symbol } from '../../../src/db/entities/symbol.entity';
import { Repository, ILike } from 'typeorm';

describe('SymbolsRepository', () => {
  let symbolsRepository: SymbolsRepository;
  let mockRepository: Partial<Repository<Symbol>>;

  beforeEach(async () => {
    // Create mock repository
    mockRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
      clear: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SymbolsRepository,
        {
          provide: getRepositoryToken(Symbol),
          useValue: mockRepository,
        },
      ],
    }).compile();

    symbolsRepository = module.get<SymbolsRepository>(SymbolsRepository);
  });

  describe('upsertSymbol', () => {
    it('should create a new symbol when it does not exist', async () => {
      const symbolData = {
        symbol: 'VNM',
        exchange: 'HOSE',
        name: 'Vinamilk',
        industryCode: 'FOOD',
        status: 'ACTIVE',
      };

      const mockSymbol = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        ...symbolData,
        createdAt: new Date(),
        updatedAt: new Date(),
        dailyQuotes: [],
        intradayQuotes: [],
      };

      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);
      (mockRepository.create as jest.Mock).mockReturnValue(mockSymbol);
      (mockRepository.save as jest.Mock).mockResolvedValue(mockSymbol);

      const result = await symbolsRepository.upsertSymbol(symbolData);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { symbol: 'VNM' },
      });
      expect(mockRepository.create).toHaveBeenCalledWith({
        symbol: 'VNM',
        exchange: 'HOSE',
        name: 'Vinamilk',
        industryCode: 'FOOD',
        status: 'ACTIVE',
      });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockSymbol);
    });

    it('should update an existing symbol', async () => {
      const existingSymbol = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        symbol: 'VNM',
        exchange: 'HOSE',
        name: 'Vinamilk',
        industryCode: 'FOOD',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        dailyQuotes: [],
        intradayQuotes: [],
      };

      const updatedData = {
        symbol: 'VNM',
        name: 'Vietnam Dairy Products JSC',
        industryCode: 'FOOD_BEVERAGE',
      };

      const mergedSymbol = {
        ...existingSymbol,
        name: 'Vietnam Dairy Products JSC',
        industryCode: 'FOOD_BEVERAGE',
      };

      (mockRepository.findOne as jest.Mock).mockResolvedValue(existingSymbol);
      (mockRepository.merge as jest.Mock).mockReturnValue(mergedSymbol);
      (mockRepository.save as jest.Mock).mockResolvedValue(mergedSymbol);

      const result = await symbolsRepository.upsertSymbol(updatedData);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { symbol: 'VNM' },
      });
      expect(mockRepository.merge).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.name).toBe('Vietnam Dairy Products JSC');
      expect(result.industryCode).toBe('FOOD_BEVERAGE');
    });

    it('should set default status to ACTIVE when not provided', async () => {
      const symbolData = {
        symbol: 'VNM',
        exchange: 'HOSE',
        name: 'Vinamilk',
      };

      const mockSymbol = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        ...symbolData,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        dailyQuotes: [],
        intradayQuotes: [],
      };

      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);
      (mockRepository.create as jest.Mock).mockReturnValue(mockSymbol);
      (mockRepository.save as jest.Mock).mockResolvedValue(mockSymbol);

      await symbolsRepository.upsertSymbol(symbolData);

      expect(mockRepository.create).toHaveBeenCalledWith({
        symbol: 'VNM',
        exchange: 'HOSE',
        name: 'Vinamilk',
        status: 'ACTIVE',
      });
    });
  });

  describe('findBySymbol', () => {
    it('should find an existing symbol', async () => {
      const mockSymbol = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        symbol: 'VNM',
        exchange: 'HOSE',
        name: 'Vinamilk',
        industryCode: 'FOOD',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        dailyQuotes: [],
        intradayQuotes: [],
      };

      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockSymbol);

      const result = await symbolsRepository.findBySymbol('VNM');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { symbol: 'VNM' },
      });
      expect(result).toEqual(mockSymbol);
    });

    it('should return null for non-existent symbol', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await symbolsRepository.findBySymbol('NONEXISTENT');

      expect(result).toBeNull();
    });
  });

  describe('searchSymbols', () => {
    it('should return all symbols when search is empty', async () => {
      const mockSymbols = [
        {
          id: '1',
          symbol: 'FPT',
          exchange: 'HOSE',
          name: 'FPT Corporation',
          industryCode: 'TECHNOLOGY',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          dailyQuotes: [],
          intradayQuotes: [],
        },
        {
          id: '2',
          symbol: 'VIC',
          exchange: 'HOSE',
          name: 'Vingroup',
          industryCode: 'REAL_ESTATE',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          dailyQuotes: [],
          intradayQuotes: [],
        },
      ];

      (mockRepository.findAndCount as jest.Mock).mockResolvedValue([
        mockSymbols,
        2,
      ]);

      const result = await symbolsRepository.searchSymbols('', 1, 10);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        order: { symbol: 'ASC' },
      });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should search by symbol code with ILIKE', async () => {
      const mockSymbol = {
        id: '1',
        symbol: 'VNM',
        exchange: 'HOSE',
        name: 'Vinamilk',
        industryCode: 'FOOD',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        dailyQuotes: [],
        intradayQuotes: [],
      };

      (mockRepository.findAndCount as jest.Mock).mockResolvedValue([
        [mockSymbol],
        1,
      ]);

      const result = await symbolsRepository.searchSymbols('vnm', 1, 10);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: [
          { symbol: ILike('%vnm%') },
          { name: ILike('%vnm%') },
          { exchange: ILike('%vnm%') },
        ],
        skip: 0,
        take: 10,
        order: { symbol: 'ASC' },
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].symbol).toBe('VNM');
    });

    it('should support pagination', async () => {
      const mockSymbols = [
        {
          id: '3',
          symbol: 'HPG',
          exchange: 'HOSE',
          name: 'Hoa Phat Group',
          industryCode: 'STEEL',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          dailyQuotes: [],
          intradayQuotes: [],
        },
      ];

      (mockRepository.findAndCount as jest.Mock).mockResolvedValue([
        mockSymbols,
        4,
      ]);

      const result = await symbolsRepository.searchSymbols('', 2, 2);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        skip: 2, // (page 2 - 1) * limit 2 = 2
        take: 2,
        order: { symbol: 'ASC' },
      });
      expect(result.total).toBe(4);
    });

    it('should return empty array when no matches found', async () => {
      (mockRepository.findAndCount as jest.Mock).mockResolvedValue([[], 0]);

      const result = await symbolsRepository.searchSymbols('NONEXISTENT', 1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getAllActive', () => {
    it('should return only active symbols', async () => {
      const mockActiveSymbols = [
        {
          id: '1',
          symbol: 'VNM',
          exchange: 'HOSE',
          name: 'Vinamilk',
          industryCode: 'FOOD',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          dailyQuotes: [],
          intradayQuotes: [],
        },
        {
          id: '2',
          symbol: 'VIC',
          exchange: 'HOSE',
          name: 'Vingroup',
          industryCode: 'REAL_ESTATE',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          dailyQuotes: [],
          intradayQuotes: [],
        },
      ];

      (mockRepository.find as jest.Mock).mockResolvedValue(mockActiveSymbols);

      const result = await symbolsRepository.getAllActive();

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        order: { symbol: 'ASC' },
      });
      expect(result).toHaveLength(2);
      expect(result.every((s) => s.status === 'ACTIVE')).toBe(true);
    });

    it('should return empty array when no active symbols', async () => {
      (mockRepository.find as jest.Mock).mockResolvedValue([]);

      const result = await symbolsRepository.getAllActive();

      expect(result).toHaveLength(0);
    });
  });
});
