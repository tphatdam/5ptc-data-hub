import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PinoLogger } from 'nestjs-pino';
import { SeedService } from './seed.service';

@Processor('seedQueue')
export class SeedProcessor {
  constructor(
    private readonly seedService: SeedService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SeedProcessor.name);
  }

  @Process({ name: 'seed:symbols', concurrency: 1 })
  async handleSeedSymbols(_job: Job): Promise<void> {
    try {
      await this.seedService.run();
    } catch (err: any) {
      this.logger.error(
        { err: err?.message, stack: err?.stack },
        'Seed job failed; degrading (app continues)',
      );
    }
  }
}
