import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { SEED_JOB_SYMBOLS, SEED_QUEUE } from '../queue/queue.constants';

@Injectable()
export class SeedBootstrapService implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(SEED_QUEUE) private readonly seedQueue: Queue,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SeedBootstrapService.name);
  }

  async onApplicationBootstrap(): Promise<void> {
    const unifiedMode = (this.configService.get<string>('unified.mode') || 'datahub').toLowerCase();
    if (unifiedMode === 'datahub') {
      this.logger.info('Seed queue skipped (unified.mode=datahub)');
      return;
    }

    const runSeed = this.configService.get<boolean>('seed.run');
    if (!runSeed) {
      this.logger.info('Seed skipped (RUN_SEED=false)');
      return;
    }
    // Fire-and-forget: do not await so app.listen() is not blocked
    this.seedQueue
      .add(SEED_JOB_SYMBOLS, {}, { removeOnComplete: true, attempts: 1 })
      .then(() => {
        this.logger.info('Seed enqueued');
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn({ err: message }, 'Failed to enqueue seed job');
      });
  }
}
