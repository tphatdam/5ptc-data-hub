import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PdfModule } from './pdf/pdf.module';
import { AiModule } from './ai/ai.module';
import { HealthModule } from './health/health.module';
import { BrevoModule } from './brevo/brevo.module';
import { QueueModule } from './queue/queue.module';
import { DailyStockReportModule } from './daily-stock-report/daily-stock-report.module';
import { DataHubModule } from './data-hub/data-hub.module';
import { LoggerMiddleware } from './middlewares/logger.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      logging: false,
    }),
    QueueModule,
    BrevoModule,
    PdfModule,
    AiModule,
    HealthModule,
    DailyStockReportModule,
    DataHubModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
