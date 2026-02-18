import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { SeedService } from './seed.service';
import { SEED_JOB_SYMBOLS, SEED_QUEUE } from '../queue/queue.constants';

@Processor(SEED_QUEUE)
export class SeedProcessor extends WorkerHost {
  constructor(
    private readonly seedService: SeedService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(SeedProcessor.name);
  }

  async process(job: Job): Promise<void> {
    if (job.name !== SEED_JOB_SYMBOLS) {
      this.logger.warn({ jobName: job.name }, 'Ignoring unsupported seed job');
      return;
    }

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
