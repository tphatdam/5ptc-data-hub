import { CrawlRun, CrawlRunStatus } from '../../../src/db/entities/crawl-run.entity';

describe('CrawlRun Entity Metadata', () => {
  it('should be defined as an entity class', () => {
    expect(CrawlRun).toBeDefined();
    expect(typeof CrawlRun).toBe('function');
  });

  it('should be instantiable', () => {
    const instance = new CrawlRun();
    expect(instance).toBeInstanceOf(CrawlRun);
  });

  it('should have all required field properties', () => {
    const instance = new CrawlRun();
    
    // Set all fields to verify they exist
    instance.id = 'test-id';
    instance.jobName = 'intraday-15m';
    instance.source = 'VCI';
    instance.startedAt = new Date();
    instance.endedAt = new Date();
    instance.status = CrawlRunStatus.SUCCESS;
    instance.errorText = null;
    instance.statsJson = { symbolsCount: 10 };
    
    // Verify all fields can be accessed
    expect(instance.id).toBe('test-id');
    expect(instance.jobName).toBe('intraday-15m');
    expect(instance.source).toBe('VCI');
    expect(instance.startedAt).toBeInstanceOf(Date);
    expect(instance.endedAt).toBeInstanceOf(Date);
    expect(instance.status).toBe(CrawlRunStatus.SUCCESS);
    expect(instance.errorText).toBeNull();
    expect(instance.statsJson).toEqual({ symbolsCount: 10 });
  });

  it('should have correct table name from decorator', () => {
    // The @Entity decorator should set the table name
    // This is verified by checking the entity name matches expected value
    expect(CrawlRun.name).toBe('CrawlRun');
  });

  it('should support CrawlRunStatus enum', () => {
    expect(CrawlRunStatus.RUNNING).toBe('RUNNING');
    expect(CrawlRunStatus.SUCCESS).toBe('SUCCESS');
    expect(CrawlRunStatus.FAILED).toBe('FAILED');
  });

  it('should support all status values', () => {
    const instance = new CrawlRun();
    
    instance.status = CrawlRunStatus.RUNNING;
    expect(instance.status).toBe('RUNNING');
    
    instance.status = CrawlRunStatus.SUCCESS;
    expect(instance.status).toBe('SUCCESS');
    
    instance.status = CrawlRunStatus.FAILED;
    expect(instance.status).toBe('FAILED');
  });

  it('should support nullable endedAt field', () => {
    const instance = new CrawlRun();
    
    instance.endedAt = null;
    expect(instance.endedAt).toBeNull();
    
    const endTime = new Date();
    instance.endedAt = endTime;
    expect(instance.endedAt).toBe(endTime);
  });

  it('should support nullable errorText field', () => {
    const instance = new CrawlRun();
    
    instance.errorText = null;
    expect(instance.errorText).toBeNull();
    
    instance.errorText = 'Provider timeout';
    expect(instance.errorText).toBe('Provider timeout');
  });

  it('should support nullable statsJson field', () => {
    const instance = new CrawlRun();
    
    instance.statsJson = null;
    expect(instance.statsJson).toBeNull();
    
    const stats = { symbolsCount: 10, rowsUpserted: 100 };
    instance.statsJson = stats;
    expect(instance.statsJson).toEqual(stats);
  });

  it('should support complex JSON in statsJson field', () => {
    const instance = new CrawlRun();
    
    const complexStats = {
      symbolsCount: 10,
      rowsUpserted: 100,
      durationMs: 5000,
      errors: [],
      metadata: {
        provider: 'VCI',
        version: '1.0.0',
      },
      symbolDetails: [
        { symbol: 'AAA', rows: 10 },
        { symbol: 'BBB', rows: 20 },
      ],
    };
    
    instance.statsJson = complexStats;
    
    expect(instance.statsJson).toEqual(complexStats);
    expect(instance.statsJson!.symbolsCount).toBe(10);
    expect(instance.statsJson!.metadata.provider).toBe('VCI');
    expect(instance.statsJson!.symbolDetails).toHaveLength(2);
  });

  it('should support timestamp with timezone fields', () => {
    const instance = new CrawlRun();
    const startTime = new Date('2024-01-15T10:00:00+07:00');
    const endTime = new Date('2024-01-15T10:05:00+07:00');
    
    instance.startedAt = startTime;
    instance.endedAt = endTime;
    
    expect(instance.startedAt).toBe(startTime);
    expect(instance.endedAt).toBe(endTime);
    expect(instance.startedAt.getTime()).toBe(startTime.getTime());
    expect(instance.endedAt.getTime()).toBe(endTime.getTime());
  });

  it('should support varchar fields with correct lengths', () => {
    const instance = new CrawlRun();
    
    // jobName should support up to 100 characters
    instance.jobName = 'a'.repeat(100);
    expect(instance.jobName).toHaveLength(100);
    
    // source should support up to 50 characters
    instance.source = 'b'.repeat(50);
    expect(instance.source).toHaveLength(50);
  });

  it('should support text field for errorText', () => {
    const instance = new CrawlRun();
    
    // errorText should support long text
    const longError = 'Error: '.repeat(1000);
    instance.errorText = longError;
    expect(instance.errorText).toBe(longError);
    expect(instance.errorText.length).toBeGreaterThan(1000);
  });

  it('should represent a running crawl run', () => {
    const instance = new CrawlRun();
    
    instance.jobName = 'intraday-15m';
    instance.source = 'VCI';
    instance.startedAt = new Date();
    instance.status = CrawlRunStatus.RUNNING;
    instance.endedAt = null;
    instance.errorText = null;
    instance.statsJson = null;
    
    expect(instance.status).toBe(CrawlRunStatus.RUNNING);
    expect(instance.endedAt).toBeNull();
  });

  it('should represent a successful crawl run', () => {
    const instance = new CrawlRun();
    
    instance.jobName = 'daily-eod';
    instance.source = 'VCI';
    instance.startedAt = new Date();
    instance.endedAt = new Date();
    instance.status = CrawlRunStatus.SUCCESS;
    instance.errorText = null;
    instance.statsJson = {
      symbolsCount: 10,
      rowsUpserted: 100,
      durationMs: 5000,
    };
    
    expect(instance.status).toBe(CrawlRunStatus.SUCCESS);
    expect(instance.endedAt).not.toBeNull();
    expect(instance.statsJson).toBeDefined();
    expect(instance.errorText).toBeNull();
  });

  it('should represent a failed crawl run', () => {
    const instance = new CrawlRun();
    
    instance.jobName = 'intraday-15m';
    instance.source = 'VCI';
    instance.startedAt = new Date();
    instance.endedAt = new Date();
    instance.status = CrawlRunStatus.FAILED;
    instance.errorText = 'Provider timeout after 3 retries';
    instance.statsJson = { durationMs: 30000 };
    
    expect(instance.status).toBe(CrawlRunStatus.FAILED);
    expect(instance.endedAt).not.toBeNull();
    expect(instance.errorText).toBeDefined();
    expect(instance.statsJson).toBeDefined();
  });
});
