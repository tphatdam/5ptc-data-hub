import { DataSource } from 'typeorm';
import { QuoteDaily } from '../../../src/db/entities/quote-daily.entity';
import { Symbol } from '../../../src/db/entities/symbol.entity';

describe('QuoteDaily Entity Metadata', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    // Create an in-memory SQLite database for testing metadata
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [Symbol, QuoteDaily],
      synchronize: true,
      logging: false,
    });

    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('should have correct table name', () => {
    const metadata = dataSource.getMetadata(QuoteDaily);
    expect(metadata.tableName).toBe('quote_daily');
  });

  it('should have primary key column', () => {
    const metadata = dataSource.getMetadata(QuoteDaily);
    const primaryColumns = metadata.primaryColumns;
    
    expect(primaryColumns).toHaveLength(1);
    expect(primaryColumns[0].propertyName).toBe('id');
    expect(primaryColumns[0].type).toBe('uuid');
  });

  it('should have all required columns', () => {
    const metadata = dataSource.getMetadata(QuoteDaily);
    const columnNames = metadata.columns.map(col => col.propertyName);
    
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('symbolId');
    expect(columnNames).toContain('date');
    expect(columnNames).toContain('open');
    expect(columnNames).toContain('high');
    expect(columnNames).toContain('low');
    expect(columnNames).toContain('close');
    expect(columnNames).toContain('volume');
    expect(columnNames).toContain('source');
    expect(columnNames).toContain('ingestedAt');
  });

  it('should have correct column types', () => {
    const metadata = dataSource.getMetadata(QuoteDaily);
    
    const getColumn = (name: string) => 
      metadata.columns.find(col => col.propertyName === name);
    
    expect(getColumn('id')?.type).toBe('uuid');
    expect(getColumn('symbolId')?.type).toBe('uuid');
    expect(getColumn('date')?.type).toBe('date');
    expect(getColumn('open')?.type).toBe('double precision');
    expect(getColumn('high')?.type).toBe('double precision');
    expect(getColumn('low')?.type).toBe('double precision');
    expect(getColumn('close')?.type).toBe('double precision');
    expect(getColumn('volume')?.type).toBe('varchar');
    expect(getColumn('source')?.type).toBe('varchar');
  });

  it('should have index on (symbolId, date)', () => {
    const metadata = dataSource.getMetadata(QuoteDaily);
    const indexes = metadata.indices;
    
    const symbolDateIndex = indexes.find(idx => 
      idx.columns.some(col => col.propertyName === 'symbolId') &&
      idx.columns.some(col => col.propertyName === 'date')
    );
    
    expect(symbolDateIndex).toBeDefined();
  });

  it('should have unique constraint on (symbolId, date, source)', () => {
    const metadata = dataSource.getMetadata(QuoteDaily);
    const uniques = metadata.uniques;
    
    const uniqueConstraint = uniques.find(unique => 
      unique.columns.some(col => col.propertyName === 'symbolId') &&
      unique.columns.some(col => col.propertyName === 'date') &&
      unique.columns.some(col => col.propertyName === 'source')
    );
    
    expect(uniqueConstraint).toBeDefined();
  });

  it('should have ManyToOne relationship with Symbol', () => {
    const metadata = dataSource.getMetadata(QuoteDaily);
    const relations = metadata.relations;
    
    const symbolRelation = relations.find(rel => rel.propertyName === 'symbol');
    
    expect(symbolRelation).toBeDefined();
    expect(symbolRelation?.relationType).toBe('many-to-one');
    expect(symbolRelation?.type).toBe(Symbol);
  });

  it('should have foreign key to Symbol entity', () => {
    const metadata = dataSource.getMetadata(QuoteDaily);
    const foreignKeys = metadata.foreignKeys;
    
    const symbolForeignKey = foreignKeys.find(fk => 
      fk.columnNames.includes('symbolId')
    );
    
    expect(symbolForeignKey).toBeDefined();
  });

  it('should have CreateDateColumn for ingestedAt', () => {
    const metadata = dataSource.getMetadata(QuoteDaily);
    const ingestedAtColumn = metadata.columns.find(col => col.propertyName === 'ingestedAt');
    
    expect(ingestedAtColumn).toBeDefined();
    expect(ingestedAtColumn?.isCreateDate).toBe(true);
  });
});
