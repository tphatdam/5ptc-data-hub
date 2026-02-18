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
});
