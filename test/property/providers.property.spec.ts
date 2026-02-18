import * as fc from 'fast-check';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SymbolDTO, DailyBarDTO, IntradayTickDTO } from '../../src/modules/providers/dtos';

describe('Provider DTOs - Property Tests', () => {
  describe('Property 17: Provider DTO mapping validity', () => {
    /**
     * **Validates: Requirements 7.4**
     * 
     * For any external data format from a provider, the mapping functions should 
     * produce DTOs that pass class-validator validation.
     */

    describe('SymbolDTO validation', () => {
      it('should validate any SymbolDTO with required fields', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              symbol: fc.string({ minLength: 1, maxLength: 20 }),
              exchange: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
              name: fc.option(fc.string({ minLength: 1, maxLength: 255 })),
              industryCode: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
            }),
            async (symbolData) => {
              // Transform plain object to DTO instance
              const symbolDTO = plainToInstance(SymbolDTO, symbolData);
              
              // Validate the DTO
              const errors = await validate(symbolDTO);
              
              // Should pass validation
              expect(errors.length).toBe(0);
              
              // Should preserve all fields
              expect(symbolDTO.symbol).toBe(symbolData.symbol);
              if (symbolData.exchange !== null) {
                expect(symbolDTO.exchange).toBe(symbolData.exchange);
              }
              if (symbolData.name !== null) {
                expect(symbolDTO.name).toBe(symbolData.name);
              }
              if (symbolData.industryCode !== null) {
                expect(symbolDTO.industryCode).toBe(symbolData.industryCode);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should reject SymbolDTO with empty symbol', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              symbol: fc.constant(''),
              exchange: fc.option(fc.string()),
              name: fc.option(fc.string()),
              industryCode: fc.option(fc.string()),
            }),
            async (symbolData) => {
              const symbolDTO = plainToInstance(SymbolDTO, symbolData);
              const errors = await validate(symbolDTO);
              
              // Should fail validation due to empty symbol
              expect(errors.length).toBeGreaterThan(0);
              expect(errors.some(e => e.property === 'symbol')).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should reject SymbolDTO with missing symbol', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              exchange: fc.option(fc.string()),
              name: fc.option(fc.string()),
              industryCode: fc.option(fc.string()),
            }),
            async (symbolData) => {
              const symbolDTO = plainToInstance(SymbolDTO, symbolData);
              const errors = await validate(symbolDTO);
              
              // Should fail validation due to missing symbol
              expect(errors.length).toBeGreaterThan(0);
              expect(errors.some(e => e.property === 'symbol')).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should accept SymbolDTO with only required symbol field', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 20 }),
            async (symbol) => {
              const symbolData = { symbol };
              const symbolDTO = plainToInstance(SymbolDTO, symbolData);
              const errors = await validate(symbolDTO);
              
              // Should pass validation with only symbol
              expect(errors.length).toBe(0);
              expect(symbolDTO.symbol).toBe(symbol);
              expect(symbolDTO.exchange).toBeUndefined();
              expect(symbolDTO.name).toBeUndefined();
              expect(symbolDTO.industryCode).toBeUndefined();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('DailyBarDTO validation', () => {
      it('should validate any DailyBarDTO with valid OHLCV data', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              date: fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
              open: fc.double({ min: 0, max: 1000000, noNaN: true }),
              high: fc.double({ min: 0, max: 1000000, noNaN: true }),
              low: fc.double({ min: 0, max: 1000000, noNaN: true }),
              close: fc.double({ min: 0, max: 1000000, noNaN: true }),
              volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(n => n.toString()),
            }),
            async (barData) => {
              // Transform plain object to DTO instance
              const barDTO = plainToInstance(DailyBarDTO, barData);
              
              // Validate the DTO
              const errors = await validate(barDTO);
              
              // Should pass validation
              expect(errors.length).toBe(0);
              
              // Should preserve all fields
              expect(barDTO.date).toBeInstanceOf(Date);
              expect(barDTO.open).toBe(barData.open);
              expect(barDTO.high).toBe(barData.high);
              expect(barDTO.low).toBe(barData.low);
              expect(barDTO.close).toBe(barData.close);
              expect(barDTO.volume).toBe(barData.volume);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should transform string dates to Date objects', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              date: fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') })
                .map(d => d.toISOString().split('T')[0]), // Convert to YYYY-MM-DD string
              open: fc.double({ min: 0, max: 1000000, noNaN: true }),
              high: fc.double({ min: 0, max: 1000000, noNaN: true }),
              low: fc.double({ min: 0, max: 1000000, noNaN: true }),
              close: fc.double({ min: 0, max: 1000000, noNaN: true }),
              volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(n => n.toString()),
            }),
            async (barData) => {
              const barDTO = plainToInstance(DailyBarDTO, barData);
              const errors = await validate(barDTO);
              
              // Should pass validation
              expect(errors.length).toBe(0);
              
              // Date should be transformed to Date object
              expect(barDTO.date).toBeInstanceOf(Date);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should reject DailyBarDTO with negative prices', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              date: fc.date(),
              priceField: fc.constantFrom('open', 'high', 'low', 'close'),
              negativeValue: fc.double({ min: -1000000, max: -0.01, noNaN: true }),
              positiveValue: fc.double({ min: 0, max: 1000000, noNaN: true }),
              volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(n => n.toString()),
            }),
            async ({ date, priceField, negativeValue, positiveValue, volume }) => {
              const barData = {
                date,
                open: positiveValue,
                high: positiveValue,
                low: positiveValue,
                close: positiveValue,
                volume,
                [priceField]: negativeValue, // Set one field to negative
              };
              
              const barDTO = plainToInstance(DailyBarDTO, barData);
              const errors = await validate(barDTO);
              
              // Should fail validation due to negative price
              expect(errors.length).toBeGreaterThan(0);
              expect(errors.some(e => e.property === priceField)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should reject DailyBarDTO with missing required fields', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.constantFrom('date', 'open', 'high', 'low', 'close', 'volume'),
            async (missingField) => {
              const completeData: any = {
                date: new Date(),
                open: 100,
                high: 105,
                low: 99,
                close: 103,
                volume: '1000000',
              };
              
              // Remove one required field
              const incompleteData = { ...completeData };
              delete incompleteData[missingField];
              
              const barDTO = plainToInstance(DailyBarDTO, incompleteData);
              const errors = await validate(barDTO);
              
              // Should fail validation due to missing field
              expect(errors.length).toBeGreaterThan(0);
              expect(errors.some(e => e.property === missingField)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should reject DailyBarDTO with empty volume', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              date: fc.date(),
              open: fc.double({ min: 0, max: 1000000, noNaN: true }),
              high: fc.double({ min: 0, max: 1000000, noNaN: true }),
              low: fc.double({ min: 0, max: 1000000, noNaN: true }),
              close: fc.double({ min: 0, max: 1000000, noNaN: true }),
              volume: fc.constant(''),
            }),
            async (barData) => {
              const barDTO = plainToInstance(DailyBarDTO, barData);
              const errors = await validate(barDTO);
              
              // Should fail validation due to empty volume
              expect(errors.length).toBeGreaterThan(0);
              expect(errors.some(e => e.property === 'volume')).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('IntradayTickDTO validation', () => {
      it('should validate any IntradayTickDTO with valid tick data', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              ts: fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
              price: fc.double({ min: 0, max: 1000000, noNaN: true }),
              volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(n => n.toString()),
            }),
            async (tickData) => {
              // Transform plain object to DTO instance
              const tickDTO = plainToInstance(IntradayTickDTO, tickData);
              
              // Validate the DTO
              const errors = await validate(tickDTO);
              
              // Should pass validation
              expect(errors.length).toBe(0);
              
              // Should preserve all fields
              expect(tickDTO.ts).toBeInstanceOf(Date);
              expect(tickDTO.price).toBe(tickData.price);
              expect(tickDTO.volume).toBe(tickData.volume);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should transform ISO string timestamps to Date objects', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              ts: fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') })
                .map(d => d.toISOString()), // Convert to ISO string
              price: fc.double({ min: 0, max: 1000000, noNaN: true }),
              volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(n => n.toString()),
            }),
            async (tickData) => {
              const tickDTO = plainToInstance(IntradayTickDTO, tickData);
              const errors = await validate(tickDTO);
              
              // Should pass validation
              expect(errors.length).toBe(0);
              
              // Timestamp should be transformed to Date object
              expect(tickDTO.ts).toBeInstanceOf(Date);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should reject IntradayTickDTO with negative price', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              ts: fc.date(),
              price: fc.double({ min: -1000000, max: -0.01, noNaN: true }),
              volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(n => n.toString()),
            }),
            async (tickData) => {
              const tickDTO = plainToInstance(IntradayTickDTO, tickData);
              const errors = await validate(tickDTO);
              
              // Should fail validation due to negative price
              expect(errors.length).toBeGreaterThan(0);
              expect(errors.some(e => e.property === 'price')).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should reject IntradayTickDTO with missing required fields', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.constantFrom('ts', 'price', 'volume'),
            async (missingField) => {
              const completeData: any = {
                ts: new Date(),
                price: 103.5,
                volume: '50000',
              };
              
              // Remove one required field
              const incompleteData = { ...completeData };
              delete incompleteData[missingField];
              
              const tickDTO = plainToInstance(IntradayTickDTO, incompleteData);
              const errors = await validate(tickDTO);
              
              // Should fail validation due to missing field
              expect(errors.length).toBeGreaterThan(0);
              expect(errors.some(e => e.property === missingField)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should reject IntradayTickDTO with empty volume', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              ts: fc.date(),
              price: fc.double({ min: 0, max: 1000000, noNaN: true }),
              volume: fc.constant(''),
            }),
            async (tickData) => {
              const tickDTO = plainToInstance(IntradayTickDTO, tickData);
              const errors = await validate(tickDTO);
              
              // Should fail validation due to empty volume
              expect(errors.length).toBeGreaterThan(0);
              expect(errors.some(e => e.property === 'volume')).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('DTO mapping with various external formats', () => {
      it('should handle SymbolDTO mapping from various external formats', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              // Simulate various external API formats
              symbolField: fc.constantFrom('symbol', 'ticker', 'code', 'stockCode'),
              symbolValue: fc.string({ minLength: 1, maxLength: 20 }),
              exchangeField: fc.constantFrom('exchange', 'market', 'exchangeCode'),
              exchangeValue: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
            }),
            async ({ symbolField, symbolValue, exchangeField, exchangeValue }) => {
              // Simulate external data with different field names
              const externalData = {
                [symbolField]: symbolValue,
                [exchangeField]: exchangeValue,
              };
              
              // Mapping function (simulates what provider would do)
              const mappedData = {
                symbol: externalData[symbolField],
                exchange: externalData[exchangeField],
              };
              
              const symbolDTO = plainToInstance(SymbolDTO, mappedData);
              const errors = await validate(symbolDTO);
              
              // Should pass validation after mapping
              expect(errors.length).toBe(0);
              expect(symbolDTO.symbol).toBe(symbolValue);
              if (exchangeValue !== null) {
                expect(symbolDTO.exchange).toBe(exchangeValue);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should handle DailyBarDTO mapping with numeric volume conversion', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              date: fc.date({ min: new Date('2000-01-01'), max: new Date('2030-12-31') }),
              open: fc.double({ min: 0, max: 1000000, noNaN: true }),
              high: fc.double({ min: 0, max: 1000000, noNaN: true }),
              low: fc.double({ min: 0, max: 1000000, noNaN: true }),
              close: fc.double({ min: 0, max: 1000000, noNaN: true }),
              // External API might return volume as number
              volumeNumber: fc.integer({ min: 0, max: 999999999 }),
            }),
            async (externalData) => {
              // Mapping function converts number to string
              const mappedData = {
                date: externalData.date,
                open: externalData.open,
                high: externalData.high,
                low: externalData.low,
                close: externalData.close,
                volume: externalData.volumeNumber.toString(),
              };
              
              const barDTO = plainToInstance(DailyBarDTO, mappedData);
              const errors = await validate(barDTO);
              
              // Should pass validation after mapping
              expect(errors.length).toBe(0);
              expect(barDTO.volume).toBe(externalData.volumeNumber.toString());
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should handle IntradayTickDTO mapping with timestamp conversion', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              // External API might return timestamp as Unix epoch
              timestampMs: fc.integer({ min: 946684800000, max: 1893456000000 }), // 2000-2030
              price: fc.double({ min: 0, max: 1000000, noNaN: true }),
              volume: fc.integer({ min: 0, max: 999999999 }),
            }),
            async (externalData) => {
              // Mapping function converts Unix timestamp to Date and volume to string
              const mappedData = {
                ts: new Date(externalData.timestampMs),
                price: externalData.price,
                volume: externalData.volume.toString(),
              };
              
              const tickDTO = plainToInstance(IntradayTickDTO, mappedData);
              const errors = await validate(tickDTO);
              
              // Should pass validation after mapping
              expect(errors.length).toBe(0);
              expect(tickDTO.ts).toBeInstanceOf(Date);
              expect(tickDTO.ts.getTime()).toBe(externalData.timestampMs);
              expect(tickDTO.volume).toBe(externalData.volume.toString());
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('DTO validation with edge cases', () => {
      it('should handle SymbolDTO with special characters in symbol', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 20 })
              .filter(s => s.trim().length > 0), // Ensure not just whitespace
            async (symbol) => {
              const symbolData = { symbol };
              const symbolDTO = plainToInstance(SymbolDTO, symbolData);
              const errors = await validate(symbolDTO);
              
              // Should pass validation (class-validator allows any non-empty string)
              expect(errors.length).toBe(0);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should handle DailyBarDTO with very small positive prices', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              date: fc.date(),
              price: fc.double({ min: 0.000001, max: 0.01, noNaN: true }),
              volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(n => n.toString()),
            }),
            async ({ date, price, volume }) => {
              const barData = {
                date,
                open: price,
                high: price,
                low: price,
                close: price,
                volume,
              };
              
              const barDTO = plainToInstance(DailyBarDTO, barData);
              const errors = await validate(barDTO);
              
              // Should pass validation with very small prices
              expect(errors.length).toBe(0);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should handle DailyBarDTO with zero prices', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              date: fc.date(),
              volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(n => n.toString()),
            }),
            async ({ date, volume }) => {
              const barData = {
                date,
                open: 0,
                high: 0,
                low: 0,
                close: 0,
                volume,
              };
              
              const barDTO = plainToInstance(DailyBarDTO, barData);
              const errors = await validate(barDTO);
              
              // Should pass validation with zero prices (edge case for halted stocks)
              expect(errors.length).toBe(0);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should handle IntradayTickDTO with zero price', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              ts: fc.date(),
              volume: fc.bigInt({ min: 0n, max: 999999999999n }).map(n => n.toString()),
            }),
            async ({ ts, volume }) => {
              const tickData = {
                ts,
                price: 0,
                volume,
              };
              
              const tickDTO = plainToInstance(IntradayTickDTO, tickData);
              const errors = await validate(tickDTO);
              
              // Should pass validation with zero price
              expect(errors.length).toBe(0);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should handle volume as string with leading zeros', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              ts: fc.date(),
              price: fc.double({ min: 0, max: 1000000, noNaN: true }),
              volumeDigits: fc.integer({ min: 1, max: 999999999 }),
              leadingZeros: fc.integer({ min: 1, max: 5 }),
            }),
            async ({ ts, price, volumeDigits, leadingZeros }) => {
              const volume = '0'.repeat(leadingZeros) + volumeDigits.toString();
              
              const tickData = { ts, price, volume };
              const tickDTO = plainToInstance(IntradayTickDTO, tickData);
              const errors = await validate(tickDTO);
              
              // Should pass validation (string volume can have leading zeros)
              expect(errors.length).toBe(0);
              expect(tickDTO.volume).toBe(volume);
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });
});
