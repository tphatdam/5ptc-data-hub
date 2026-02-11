import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class SeedBootstrapService implements OnApplicationBootstrap {
  constructor(
    @InjectQueue('seedQueue') private readonly seedQueue: Queue,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SeedBootstrapService.name);
  }

  onApplicationBootstrap(): void {
    const runSeed = this.configService.get<boolean>('seed.run');
    if (!runSeed) {
      this.logger.info('Seed skipped (RUN_SEED=false)');
      return;
    }
    this.seedQueue
      .add('seed:symbols', {}, { removeOnComplete: true, attempts: 1 })
      .then(() => {
        this.logger.info('Seed enqueued');
      })
      .catch((err) => {
        this.logger.warn({ err: err?.message }, 'Failed to enqueue seed job');
      });
  }
}
