import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { EmailProcessor } from './email.processor';
import { BrevoModule } from '../brevo/brevo.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get('REDIS_URL');
        const nodeEnv = configService.get('NODE_ENV', 'development');
        const prefix = `PDF_${nodeEnv}`;
        
        let redisConfig: any;
        
        if (redisUrl) {
          try {
            const url = new URL(redisUrl);
            redisConfig = {
              host: url.hostname,
              port: parseInt(url.port) || 6379,
              password: url.password || undefined,
              username: url.username || undefined,
              tls: url.protocol === 'rediss:' ? {} : undefined,
              retryStrategy: (times: number) => {
                const delay = Math.min(Math.pow(2, times) * 100, 5000);
                strapi.log.info(`[QueueModule] Redis connection retry attempt ${times}, waiting ${delay}ms`);
                return delay;
              },
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
              enableOfflineQueue: true,
            };
            strapi.log.info(`[QueueModule] Using REDIS_URL configuration - Host: ${redisConfig.host}, Port: ${redisConfig.port}, TLS: ${!!redisConfig.tls}, Prefix: ${prefix}`);
          } catch (error) {
            console.error('[QueueModule] Failed to parse REDIS_URL:', error);
            throw new Error('Invalid REDIS_URL format');
          }
        } else {
          const host = configService.get('REDIS_HOST', 'localhost');
          const port = configService.get('REDIS_PORT', 6379);
          const password = configService.get('REDIS_PASSWORD');
          
          redisConfig = {
            host,
            port,
            password: password || undefined,
            retryStrategy: (times: number) => {
              const delay = Math.min(Math.pow(2, times) * 100, 5000);
              strapi.log.info(`[QueueModule] Redis connection retry attempt ${times}, waiting ${delay}ms`);
              return delay;
            },
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            enableOfflineQueue: true,
          };
          strapi.log.info(`[QueueModule] Using REDIS_HOST/PORT configuration - Host: ${host}, Port: ${port}, Prefix: ${prefix}`);
        }
        
        return { 
          redis: redisConfig,
          prefix,
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'reportQueue',
    }),
    BullModule.registerQueue({
      name: 'emailQueue',
    }),
    BrevoModule,
  ],
  providers: [QueueService, EmailProcessor],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
