import { DataSource } from 'typeorm';
import { seedDatabase } from '../seed/seed';
import { StartupSeedService } from './startup-seed.service';

jest.mock('../seed/seed', () => ({
  seedDatabase: jest.fn(),
}));

describe('StartupSeedService', () => {
  const seedDatabaseMock = seedDatabase as jest.MockedFunction<typeof seedDatabase>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs reference seed then symbol sync when lock is acquired', async () => {
    const dataSource = {} as DataSource;
    const symbolSyncJob = {
      runNow: jest.fn().mockResolvedValue(undefined),
    };
    const advisoryLockService = {
      withLock: jest.fn(async (_name, run: () => Promise<void>) => {
        await run();
        return { executed: true };
      }),
    };

    const service = new StartupSeedService(
      dataSource,
      advisoryLockService as any,
      symbolSyncJob as any,
    );

    await service.runOnStartup();

    expect(advisoryLockService.withLock).toHaveBeenCalledWith(
      'StartupSeedJob',
      expect.any(Function),
      expect.any(Function),
    );
    expect(seedDatabaseMock).toHaveBeenCalledWith(dataSource);
    expect(symbolSyncJob.runNow).toHaveBeenCalledTimes(1);
  });

  it('skips seeding when lock is already held', async () => {
    const dataSource = {} as DataSource;
    const symbolSyncJob = {
      runNow: jest.fn().mockResolvedValue(undefined),
    };
    const advisoryLockService = {
      withLock: jest.fn(async (_name, _run: () => Promise<void>, onSkip: () => Promise<void>) => {
        await onSkip();
        return { executed: false };
      }),
    };

    const service = new StartupSeedService(
      dataSource,
      advisoryLockService as any,
      symbolSyncJob as any,
    );

    await service.runOnStartup();

    expect(seedDatabaseMock).not.toHaveBeenCalled();
    expect(symbolSyncJob.runNow).not.toHaveBeenCalled();
  });

  it('does not throw when lock execution fails', async () => {
    const dataSource = {} as DataSource;
    const symbolSyncJob = {
      runNow: jest.fn().mockResolvedValue(undefined),
    };
    const advisoryLockService = {
      withLock: jest.fn().mockRejectedValue(new Error('lock error')),
    };

    const service = new StartupSeedService(
      dataSource,
      advisoryLockService as any,
      symbolSyncJob as any,
    );

    await expect(service.runOnStartup()).resolves.toBeUndefined();
  });
});
