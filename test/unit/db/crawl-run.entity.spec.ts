import { CrawlRun, CrawlRunStatus } from '../../../src/db/entities/crawl-run.entity';

describe('CrawlRun Entity', () => {
  it('should be defined', () => {
    expect(CrawlRun).toBeDefined();
  });

  it('should have all required fields', () => {
    const crawlRun = new CrawlRun();
    
    // Set values to verify the entity structure
    crawlRun.id = '123e4567-e89b-12d3-a456-426614174000';
    crawlRun.jobName = 'intraday-15m';
    crawlRun.source = 'VCI';
    crawlRun.startedAt = new Date();
    crawlRun.endedAt = new Date();
    crawlRun.status = CrawlRunStatus.SUCCESS;
    crawlRun.errorText = null;
    crawlRun.statsJson = { symbolsCount: 10, rowsUpserted: 100, durationMs: 5000 };
    
    // Verify all properties can be set and retrieved
    expect(crawlRun.id).toBeDefined();
    expect(crawlRun.jobName).toBeDefined();
    expect(crawlRun.source).toBeDefined();
    expect(crawlRun.startedAt).toBeDefined();
    expect(crawlRun.endedAt).toBeDefined();
    expect(crawlRun.status).toBeDefined();
    expect(crawlRun.errorText).toBeNull();
    expect(crawlRun.statsJson).toBeDefined();
  });

  it('should allow setting all fields', () => {
    const crawlRun = new CrawlRun();
    const startTime = new Date('2024-01-15T10:00:00Z');
    const endTime = new Date('2024-01-15T10:05:00Z');
    const stats = { symbolsCount: 10, rowsUpserted: 100, durationMs: 5000 };
    
    crawlRun.id = '123e4567-e89b-12d3-a456-426614174000';
    crawlRun.jobName = 'intraday-15m';
    crawlRun.source = 'VCI';
    crawlRun.startedAt = startTime;
    crawlRun.endedAt = endTime;
    crawlRun.status = CrawlRunStatus.SUCCESS;
    crawlRun.errorText = null;
    crawlRun.statsJson = stats;
    
    expect(crawlRun.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(crawlRun.jobName).toBe('intraday-15m');
    expect(crawlRun.source).toBe('VCI');
    expect(crawlRun.startedAt).toBe(startTime);
    expect(crawlRun.endedAt).toBe(endTime);
    expect(crawlRun.status).toBe(CrawlRunStatus.SUCCESS);
    expect(crawlRun.errorText).toBeNull();
    expect(crawlRun.statsJson).toEqual(stats);
  });

  it('should support RUNNING status', () => {
    const crawlRun = new CrawlRun();
    crawlRun.status = CrawlRunStatus.RUNNING;
    
    expect(crawlRun.status).toBe(CrawlRunStatus.RUNNING);
    expect(crawlRun.status).toBe('RUNNING');
  });

  it('should support SUCCESS status', () => {
    const crawlRun = new CrawlRun();
    crawlRun.status = CrawlRunStatus.SUCCESS;
    
    expect(crawlRun.status).toBe(CrawlRunStatus.SUCCESS);
    expect(crawlRun.status).toBe('SUCCESS');
  });

  it('should support FAILED status', () => {
    const crawlRun = new CrawlRun();
    crawlRun.status = CrawlRunStatus.FAILED;
    
    expect(crawlRun.status).toBe(CrawlRunStatus.FAILED);
    expect(crawlRun.status).toBe('FAILED');
  });

  it('should allow nullable endedAt for running jobs', () => {
    const crawlRun = new CrawlRun();
    crawlRun.status = CrawlRunStatus.RUNNING;
    crawlRun.endedAt = null;
    
    expect(crawlRun.endedAt).toBeNull();
  });

  it('should allow nullable errorText for successful jobs', () => {
    const crawlRun = new CrawlRun();
    crawlRun.status = CrawlRunStatus.SUCCESS;
    crawlRun.errorText = null;
    
    expect(crawlRun.errorText).toBeNull();
  });

  it('should allow errorText for failed jobs', () => {
    const crawlRun = new CrawlRun();
    crawlRun.status = CrawlRunStatus.FAILED;
    crawlRun.errorText = 'Provider timeout';
    
    expect(crawlRun.errorText).toBe('Provider timeout');
  });

  it('should allow nullable statsJson', () => {
    const crawlRun = new CrawlRun();
    crawlRun.statsJson = null;
    
    expect(crawlRun.statsJson).toBeNull();
  });

  it('should support complex statsJson objects', () => {
    const crawlRun = new CrawlRun();
    const complexStats = {
      symbolsCount: 10,
      rowsUpserted: 100,
      durationMs: 5000,
      errors: [],
      metadata: {
        provider: 'VCI',
        version: '1.0.0',
      },
    };
    
    crawlRun.statsJson = complexStats;
    
    expect(crawlRun.statsJson).toEqual(complexStats);
    expect(crawlRun.statsJson.symbolsCount).toBe(10);
    expect(crawlRun.statsJson.metadata.provider).toBe('VCI');
  });
});
