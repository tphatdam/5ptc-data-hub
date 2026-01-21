import { QuoteDaily } from '../../../src/db/entities/quote-daily.entity';
import { Symbol } from '../../../src/db/entities/symbol.entity';

describe('QuoteDaily Entity', () => {
  it('should be defined', () => {
    expect(QuoteDaily).toBeDefined();
  });

  it('should have all required fields', () => {
    const quoteDaily = new QuoteDaily();
    
    // Set values to verify the entity structure
    quoteDaily.id = '123e4567-e89b-12d3-a456-426614174000';
    quoteDaily.symbolId = '123e4567-e89b-12d3-a456-426614174001';
    quoteDaily.date = new Date('2024-01-15');
    quoteDaily.open = 100.5;
    quoteDaily.high = 105.0;
    quoteDaily.low = 99.0;
    quoteDaily.close = 103.5;
    quoteDaily.volume = '1000000';
    quoteDaily.source = 'VCI';
    quoteDaily.ingestedAt = new Date();
    
    // Verify all properties can be set and retrieved
    expect(quoteDaily.id).toBeDefined();
    expect(quoteDaily.symbolId).toBeDefined();
    expect(quoteDaily.date).toBeDefined();
    expect(quoteDaily.open).toBeDefined();
    expect(quoteDaily.high).toBeDefined();
    expect(quoteDaily.low).toBeDefined();
    expect(quoteDaily.close).toBeDefined();
    expect(quoteDaily.volume).toBeDefined();
    expect(quoteDaily.source).toBeDefined();
    expect(quoteDaily.ingestedAt).toBeDefined();
  });

  it('should allow setting all fields', () => {
    const quoteDaily = new QuoteDaily();
    const testDate = new Date('2024-01-15');
    
    quoteDaily.id = '123e4567-e89b-12d3-a456-426614174000';
    quoteDaily.symbolId = '123e4567-e89b-12d3-a456-426614174001';
    quoteDaily.date = testDate;
    quoteDaily.open = 100.5;
    quoteDaily.high = 105.0;
    quoteDaily.low = 99.0;
    quoteDaily.close = 103.5;
    quoteDaily.volume = '1000000';
    quoteDaily.source = 'VCI';
    quoteDaily.ingestedAt = new Date();
    
    expect(quoteDaily.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(quoteDaily.symbolId).toBe('123e4567-e89b-12d3-a456-426614174001');
    expect(quoteDaily.date).toBe(testDate);
    expect(quoteDaily.open).toBe(100.5);
    expect(quoteDaily.high).toBe(105.0);
    expect(quoteDaily.low).toBe(99.0);
    expect(quoteDaily.close).toBe(103.5);
    expect(quoteDaily.volume).toBe('1000000');
    expect(quoteDaily.source).toBe('VCI');
    expect(quoteDaily.ingestedAt).toBeInstanceOf(Date);
  });

  it('should have relationship with Symbol entity', () => {
    const quoteDaily = new QuoteDaily();
    const symbol = new Symbol();
    
    quoteDaily.symbol = symbol;
    
    expect(quoteDaily.symbol).toBe(symbol);
    expect(quoteDaily.symbol).toBeInstanceOf(Symbol);
  });
});
