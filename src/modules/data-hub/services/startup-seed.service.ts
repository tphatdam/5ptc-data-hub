import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { seedDatabase } from '../seed/seed';
import { SymbolSyncJob } from '../jobs/symbol-sync.job';
import { AdvisoryLockService } from './advisory-lock.service';

@Injectable()
export class StartupSeedService {
  private readonly logger = new Logger(StartupSeedService.name);
  private readonly lockName = 'StartupSeedJob';

  constructor(
    private readonly dataSource: DataSource,
    private readonly advisoryLockService: AdvisoryLockService,
    private readonly symbolSyncJob: SymbolSyncJob,
  ) {}

  async runOnStartup(): Promise<void> {
    try {
      await this.advisoryLockService.withLock(
        this.lockName,
        async () => {
          this.logger.log('Startup seed started');
          await seedDatabase(this.dataSource);
          await this.symbolSyncJob.runNow();
          this.logger.log('Startup seed completed');
        },
        async () => {
          this.logger.log('Startup seed skipped (lock held)');
        },
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Startup seed failed (continuing): ${message}`);
    }
  }
}
