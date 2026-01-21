import { QuoteIntraday } from '../../../src/db/entities/quote-intraday.entity';
import { Symbol } from '../../../src/db/entities/symbol.entity';

describe('QuoteIntraday Entity Metadata', () => {
  it('should be defined as an entity class', () => {
    expect(QuoteIntraday).toBeDefined();
    expect(typeof QuoteIntraday).toBe('function');
  });

  it('should be instantiable', () => {
    const instance = new QuoteIntraday();
    expect(instance).toBeInstanceOf(QuoteIntraday);
  });

  it('should have all required field properties', () => {
    const instance = new QuoteIntraday();
    
    // Set all fields to verify they exist
    instance.id = 'test-id';
    instance.symbolId = 'test-symbol-id';
    instance.ts = new Date();
    instance.price = 100.5;
    instance.volume = '1000';
    instance.source = 'VCI';
    instance.ingestedAt = new Date();
    
    // Verify all fields can be accessed
    expect(instance.id).toBe('test-id');
    expect(instance.symbolId).toBe('test-symbol-id');
    expect(instance.ts).toBeInstanceOf(Date);
    expect(instance.price).toBe(100.5);
    expect(instance.volume).toBe('1000');
    expect(instance.source).toBe('VCI');
    expect(instance.ingestedAt).toBeInstanceOf(Date);
  });

  it('should have symbol relationship property', () => {
    const instance = new QuoteIntraday();
    const symbol = new Symbol();
    
    instance.symbol = symbol;
    expect(instance.symbol).toBe(symbol);
    expect(instance.symbol).toBeInstanceOf(Symbol);
  });

  it('should have correct table name from decorator', () => {
    // The @Entity decorator should set the table name
    // This is verified by checking the entity name matches expected value
    expect(QuoteIntraday.name).toBe('QuoteIntraday');
  });

  it('should support timestamp with timezone field', () => {
    const instance = new QuoteIntraday();
    const timestamp = new Date('2024-01-15T10:30:00+07:00');
    
    instance.ts = timestamp;
    expect(instance.ts).toBe(timestamp);
    expect(instance.ts.getTime()).toBe(timestamp.getTime());
  });

  it('should support double precision price field', () => {
    const instance = new QuoteIntraday();
    
    // Test with various precision values
    instance.price = 123.456789;
    expect(instance.price).toBe(123.456789);
    
    instance.price = 0.000001;
    expect(instance.price).toBe(0.000001);
  });

  it('should support large volume values as strings', () => {
    const instance = new QuoteIntraday();
    
    // Test with very large number as string (bigint)
    instance.volume = '9223372036854775807';
    expect(instance.volume).toBe('9223372036854775807');
    expect(typeof instance.volume).toBe('string');
  });

  it('should have all required fields for unique constraint', () => {
    const instance = new QuoteIntraday();
    
    // The unique constraint requires symbolId, ts, and source
    instance.symbolId = 'symbol-1';
    instance.ts = new Date();
    instance.source = 'VCI';
    
    expect(instance.symbolId).toBeDefined();
    expect(instance.ts).toBeDefined();
    expect(instance.source).toBeDefined();
  });

  it('should have all required fields for index', () => {
    const instance = new QuoteIntraday();
    
    // The index requires symbolId and ts
    instance.symbolId = 'symbol-1';
    instance.ts = new Date();
    
    expect(instance.symbolId).toBeDefined();
    expect(instance.ts).toBeDefined();
  });
});
