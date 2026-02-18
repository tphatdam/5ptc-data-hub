import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SymbolDTO, DailyBarDTO, IntradayTickDTO } from '../../../src/modules/providers/dtos';

describe('Provider DTOs', () => {
  describe('SymbolDTO', () => {
    it('should validate a valid symbol DTO', async () => {
      const symbolData = {
        symbol: 'VNM',
        exchange: 'HOSE',
        name: 'Vietnam Dairy Products',
        industryCode: 'FOOD',
      };

      const symbolDTO = plainToInstance(SymbolDTO, symbolData);
      const errors = await validate(symbolDTO);

      expect(errors.length).toBe(0);
      expect(symbolDTO.symbol).toBe('VNM');
      expect(symbolDTO.exchange).toBe('HOSE');
      expect(symbolDTO.name).toBe('Vietnam Dairy Products');
      expect(symbolDTO.industryCode).toBe('FOOD');
    });

    it('should validate a symbol DTO with only required fields', async () => {
      const symbolData = {
        symbol: 'VNM',
      };

      const symbolDTO = plainToInstance(SymbolDTO, symbolData);
      const errors = await validate(symbolDTO);

      expect(errors.length).toBe(0);
      expect(symbolDTO.symbol).toBe('VNM');
      expect(symbolDTO.exchange).toBeUndefined();
      expect(symbolDTO.name).toBeUndefined();
      expect(symbolDTO.industryCode).toBeUndefined();
    });

    it('should fail validation when symbol is missing', async () => {
      const symbolData = {
        exchange: 'HOSE',
      };

      const symbolDTO = plainToInstance(SymbolDTO, symbolData);
      const errors = await validate(symbolDTO);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('symbol');
    });

    it('should fail validation when symbol is empty', async () => {
      const symbolData = {
        symbol: '',
      };

      const symbolDTO = plainToInstance(SymbolDTO, symbolData);
      const errors = await validate(symbolDTO);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('symbol');
    });
  });

  describe('DailyBarDTO', () => {
    it('should validate a valid daily bar DTO', async () => {
      const barData = {
        date: new Date('2024-01-15'),
        open: 100.5,
        high: 105.0,
        low: 99.0,
        close: 103.5,
        volume: '1000000',
      };

      const barDTO = plainToInstance(DailyBarDTO, barData);
      const errors = await validate(barDTO);

      expect(errors.length).toBe(0);
      expect(barDTO.date).toBeInstanceOf(Date);
      expect(barDTO.open).toBe(100.5);
      expect(barDTO.high).toBe(105.0);
      expect(barDTO.low).toBe(99.0);
      expect(barDTO.close).toBe(103.5);
      expect(barDTO.volume).toBe('1000000');
    });

    it('should transform string date to Date object', async () => {
      const barData = {
        date: '2024-01-15',
        open: 100.5,
        high: 105.0,
        low: 99.0,
        close: 103.5,
        volume: '1000000',
      };

      const barDTO = plainToInstance(DailyBarDTO, barData);
      const errors = await validate(barDTO);

      expect(errors.length).toBe(0);
      expect(barDTO.date).toBeInstanceOf(Date);
    });

    it('should fail validation when required fields are missing', async () => {
      const barData = {
        date: new Date('2024-01-15'),
        open: 100.5,
        // missing high, low, close, volume
      };

      const barDTO = plainToInstance(DailyBarDTO, barData);
      const errors = await validate(barDTO);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when prices are negative', async () => {
      const barData = {
        date: new Date('2024-01-15'),
        open: -100.5,
        high: 105.0,
        low: 99.0,
        close: 103.5,
        volume: '1000000',
      };

      const barDTO = plainToInstance(DailyBarDTO, barData);
      const errors = await validate(barDTO);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('open');
    });

    it('should fail validation when volume is empty', async () => {
      const barData = {
        date: new Date('2024-01-15'),
        open: 100.5,
        high: 105.0,
        low: 99.0,
        close: 103.5,
        volume: '',
      };

      const barDTO = plainToInstance(DailyBarDTO, barData);
      const errors = await validate(barDTO);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('volume');
    });
  });

  describe('IntradayTickDTO', () => {
    it('should validate a valid intraday tick DTO', async () => {
      const tickData = {
        ts: new Date('2024-01-15T10:30:00Z'),
        price: 103.5,
        volume: '50000',
      };

      const tickDTO = plainToInstance(IntradayTickDTO, tickData);
      const errors = await validate(tickDTO);

      expect(errors.length).toBe(0);
      expect(tickDTO.ts).toBeInstanceOf(Date);
      expect(tickDTO.price).toBe(103.5);
      expect(tickDTO.volume).toBe('50000');
    });

    it('should transform string timestamp to Date object', async () => {
      const tickData = {
        ts: '2024-01-15T10:30:00Z',
        price: 103.5,
        volume: '50000',
      };

      const tickDTO = plainToInstance(IntradayTickDTO, tickData);
      const errors = await validate(tickDTO);

      expect(errors.length).toBe(0);
      expect(tickDTO.ts).toBeInstanceOf(Date);
    });

    it('should fail validation when required fields are missing', async () => {
      const tickData = {
        ts: new Date('2024-01-15T10:30:00Z'),
        // missing price and volume
      };

      const tickDTO = plainToInstance(IntradayTickDTO, tickData);
      const errors = await validate(tickDTO);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail validation when price is negative', async () => {
      const tickData = {
        ts: new Date('2024-01-15T10:30:00Z'),
        price: -103.5,
        volume: '50000',
      };

      const tickDTO = plainToInstance(IntradayTickDTO, tickData);
      const errors = await validate(tickDTO);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('price');
    });

    it('should fail validation when volume is empty', async () => {
      const tickData = {
        ts: new Date('2024-01-15T10:30:00Z'),
        price: 103.5,
        volume: '',
      };

      const tickDTO = plainToInstance(IntradayTickDTO, tickData);
      const errors = await validate(tickDTO);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('volume');
    });
  });
});
