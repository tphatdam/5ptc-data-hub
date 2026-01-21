import { QuoteIntraday } from '../../../src/db/entities/quote-intraday.entity';
import { Symbol } from '../../../src/db/entities/symbol.entity';

describe('QuoteIntraday Entity', () => {
  it('should be defined', () => {
    expect(QuoteIntraday).toBeDefined();
  });

  it('should have all required fields', () => {
    const quoteIntraday = new QuoteIntraday();
    
    // Set values to verify the entity structure
    quoteIntraday.id = '123e4567-e89b-12d3-a456-426614174000';
    quoteIntraday.symbolId = '123e4567-e89b-12d3-a456-426614174001';
    quoteIntraday.ts = new Date('2024-01-15T10:30:00Z');
    quoteIntraday.price = 103.5;
    quoteIntraday.volume = '50000';
    quoteIntraday.source = 'VCI';
    quoteIntraday.ingestedAt = new Date();
    
    // Verify all properties can be set and retrieved
    expect(quoteIntraday.id).toBeDefined();
    expect(quoteIntraday.symbolId).toBeDefined();
    expect(quoteIntraday.ts).toBeDefined();
    expect(quoteIntraday.price).toBeDefined();
    expect(quoteIntraday.volume).toBeDefined();
    expect(quoteIntraday.source).toBeDefined();
    expect(quoteIntraday.ingestedAt).toBeDefined();
  });

  it('should allow setting all fields', () => {
    const quoteIntraday = new QuoteIntraday();
    const testTimestamp = new Date('2024-01-15T10:30:00Z');
    
    quoteIntraday.id = '123e4567-e89b-12d3-a456-426614174000';
    quoteIntraday.symbolId = '123e4567-e89b-12d3-a456-426614174001';
    quoteIntraday.ts = testTimestamp;
    quoteIntraday.price = 103.5;
    quoteIntraday.volume = '50000';
    quoteIntraday.source = 'VCI';
    quoteIntraday.ingestedAt = new Date();
    
    expect(quoteIntraday.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(quoteIntraday.symbolId).toBe('123e4567-e89b-12d3-a456-426614174001');
    expect(quoteIntraday.ts).toBe(testTimestamp);
    expect(quoteIntraday.price).toBe(103.5);
    expect(quoteIntraday.volume).toBe('50000');
    expect(quoteIntraday.source).toBe('VCI');
    expect(quoteIntraday.ingestedAt).toBeInstanceOf(Date);
  });

  it('should have relationship with Symbol entity', () => {
    const quoteIntraday = new QuoteIntraday();
    const symbol = new Symbol();
    
    quoteIntraday.symbol = symbol;
    
    expect(quoteIntraday.symbol).toBe(symbol);
    expect(quoteIntraday.symbol).toBeInstanceOf(Symbol);
  });

  it('should store volume as string for bigint values', () => {
    const quoteIntraday = new QuoteIntraday();
    
    // Test with large volume value as string
    quoteIntraday.volume = '9223372036854775807'; // Max bigint value
    
    expect(quoteIntraday.volume).toBe('9223372036854775807');
    expect(typeof quoteIntraday.volume).toBe('string');
  });

  it('should handle timestamp with timezone', () => {
    const quoteIntraday = new QuoteIntraday();
    const timestamp = new Date('2024-01-15T10:30:00+07:00'); // Vietnam timezone
    
    quoteIntraday.ts = timestamp;
    
    expect(quoteIntraday.ts).toBe(timestamp);
    expect(quoteIntraday.ts).toBeInstanceOf(Date);
  });
});
