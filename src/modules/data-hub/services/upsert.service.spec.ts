import { DataSource, QueryRunner } from 'typeorm';
import { UpsertService } from './upsert.service';

describe('UpsertService', () => {
  it('returns correct inserted/updated/processed metrics and logs completion event', async () => {
    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([{ inserted: true }, { inserted: false }]),
    } as unknown as QueryRunner;

    const dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as unknown as DataSource;

    const service = new UpsertService(dataSource);
    const logPayloads: Array<Record<string, unknown>> = [];
    const logSpy = jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation((...args: unknown[]) => {
        const message = String(args[0]);
        logPayloads.push(JSON.parse(message));
      });

    const result = await service.upsertStockCandles([
      {
        symbolId: 1,
        interval: 'INTRADAY_15M',
        ts: new Date('2026-02-18T02:15:00.000Z'),
        open: '10',
        high: '11',
        low: '9',
        close: '10.5',
        volume: '1000',
        sourceId: 7,
      },
      {
        symbolId: 1,
        interval: 'INTRADAY_15M',
        ts: new Date('2026-02-18T02:30:00.000Z'),
        open: '10.5',
        high: '11.5',
        low: '10',
        close: '11',
        volume: '1200',
        sourceId: 7,
      },
    ]);

    expect(result).toEqual({
      inserted: 1,
      updated: 1,
      skipped: 0,
      processed: 2,
    });

    const completedEvent = logPayloads.find(
      (entry) => entry.event === 'upsert_batch_completed',
    );
    expect(completedEvent).toBeDefined();
    expect(completedEvent?.processed).toBe(2);
    expect(queryRunner.query).toHaveBeenCalled();
    expect((queryRunner.query as jest.Mock).mock.calls[0][0]).toContain('RETURNING (xmax = 0) AS inserted');

    logSpy.mockRestore();
  });

  it('upserts stock related peers with canonical conflict key', async () => {
    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([{ inserted: true }]),
    } as unknown as QueryRunner;

    const service = new UpsertService({
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as unknown as DataSource);

    const result = await service.upsertStockRelatedPeers([
      {
        symbolId: 1,
        peerTicker: 'BBB',
        relationType: 'sector',
        score: 0.82,
        sourceId: 99,
      },
    ]);

    expect(result.processed).toBe(1);
    expect((queryRunner.query as jest.Mock).mock.calls[0][0]).toContain('"stock_related_peer"');
    expect((queryRunner.query as jest.Mock).mock.calls[0][0]).toContain(
      'ON CONFLICT ("symbol_id", "peer_ticker", "source_id")',
    );
  });

  it('upserts company subsidiaries and reports with expected unique keys', async () => {
    const queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest
        .fn()
        .mockResolvedValueOnce([{ inserted: true }])
        .mockResolvedValueOnce([{ inserted: false }]),
    } as unknown as QueryRunner;

    const service = new UpsertService({
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    } as unknown as DataSource);

    await service.upsertCompanySubsidiaries([
      {
        parentSymbolId: 1,
        subsidiaryName: 'ABC Holdings',
        ownershipPercent: 51.2,
        relationshipType: 'subsidiary',
        sourceId: 7,
      },
    ]);

    await service.upsertCompanyReports([
      {
        symbolId: 1,
        reportType: 'annual',
        title: 'Annual Report',
        publishedAt: new Date('2026-01-01'),
        fileUrl: 'https://example.com/report.pdf',
        fileUrlHash: 'abc123',
        sourceId: 7,
      },
    ]);

    expect((queryRunner.query as jest.Mock).mock.calls[0][0]).toContain('"company_subsidiary"');
    expect((queryRunner.query as jest.Mock).mock.calls[0][0]).toContain(
      'ON CONFLICT ("parent_symbol_id", "subsidiary_name", "source_id")',
    );
    expect((queryRunner.query as jest.Mock).mock.calls[1][0]).toContain('"company_report"');
    expect((queryRunner.query as jest.Mock).mock.calls[1][0]).toContain(
      'ON CONFLICT ("symbol_id", "file_url_hash", "source_id")',
    );
  });
});
