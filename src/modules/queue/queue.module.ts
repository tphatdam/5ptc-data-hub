import { InjectQueue, BullModule } from '@nestjs/bullmq';
import { Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import { logPayload, toLogError } from '../../common/logging/ingestion-log';
import { BrevoModule } from '../brevo/brevo.module';
import { EmailProcessor } from './email.processor';
import {
  COMPANY_INTEL_QUEUE,
  EMAIL_QUEUE,
  MARKET_INTRADAY_QUEUE,
  REPORT_QUEUE,
  TRIGGER_ORCHESTRATOR_QUEUE,
} from './queue.constants';
import { QueueService } from './queue.service';

type QueueClientWithEvents = {
  status?: string;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
};

function getQueueConnection(configService: ConfigService): RedisOptions {
  const redisUrl = configService.get<string>('redis.url');
  if (!redisUrl) {
    throw new Error('REDIS_URL is required');
  }
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port) || 6379,
    password: url.password || undefined,
    username: url.username || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: true,
  };
}

@Injectable()
class QueueConnectionLogger implements OnModuleInit {
  private readonly logger = new Logger(QueueConnectionLogger.name);
  private readonly observedQueues = new Set<string>();

  constructor(
    @InjectQueue(REPORT_QUEUE) private readonly reportQueue: Queue,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue,
    @InjectQueue(MARKET_INTRADAY_QUEUE) private readonly marketIntradayQueue: Queue,
    @InjectQueue(COMPANY_INTEL_QUEUE) private readonly companyIntelQueue: Queue,
    @InjectQueue(TRIGGER_ORCHESTRATOR_QUEUE)
    private readonly triggerOrchestratorQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await Promise.all([
      this.observeQueueConnection(this.reportQueue),
      this.observeQueueConnection(this.emailQueue),
      this.observeQueueConnection(this.marketIntradayQueue),
      this.observeQueueConnection(this.companyIntelQueue),
      this.observeQueueConnection(this.triggerOrchestratorQueue),
    ]);
  }

  private async observeQueueConnection(queue: Queue): Promise<void> {
    const queueName = queue.name;
    if (this.observedQueues.has(queueName)) {
      return;
    }
    this.observedQueues.add(queueName);

    try {
      const client = (await queue.client) as unknown as QueueClientWithEvents;
      this.logger.log(
        logPayload({
          event: 'queue_connection_ready',
          module: 'queue',
          queueName,
          status: client.status || 'ready',
        }),
      );

      client.on('ready', () => {
        this.logger.log(
          logPayload({
            event: 'queue_connection_ready',
            module: 'queue',
            queueName,
            status: 'ready',
          }),
        );
      });

      client.on('error', (error: unknown) => {
        this.logger.error(
          logPayload({
            event: 'queue_connection_error',
            module: 'queue',
            queueName,
            status: 'error',
            error: toLogError(error),
          }),
        );
      });

      client.on('reconnecting', (delayMs: unknown) => {
        this.logger.warn(
          logPayload({
            event: 'queue_reconnect_attempt',
            module: 'queue',
            queueName,
            status: 'reconnecting',
            durationMs:
              typeof delayMs === 'number' && Number.isFinite(delayMs)
                ? delayMs
                : undefined,
          }),
        );
      });
    } catch (error: unknown) {
      this.logger.error(
        logPayload({
          event: 'queue_connection_error',
          module: 'queue',
          queueName,
          status: 'error',
          error: toLogError(error),
        }),
      );
    }
  }
}

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        return {
          connection: getQueueConnection(configService),
          prefix: `PDF_${nodeEnv}`,
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: REPORT_QUEUE },
      { name: EMAIL_QUEUE },
      { name: MARKET_INTRADAY_QUEUE },
      { name: COMPANY_INTEL_QUEUE },
      { name: TRIGGER_ORCHESTRATOR_QUEUE },
    ),
    BrevoModule,
  ],
  providers: [QueueService, EmailProcessor, QueueConnectionLogger],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
