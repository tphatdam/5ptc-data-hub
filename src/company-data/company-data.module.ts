import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyReport } from '../db/entities/company-report.entity';
import { CompanySubsidiary } from '../db/entities/company-subsidiary.entity';
import { ForeignTradingDaily } from '../db/entities/foreign-trading-daily.entity';
import { InsiderTradingEvent } from '../db/entities/insider-trading-event.entity';
import { NewsArticle } from '../db/entities/news-article.entity';
import { StockRelatedPeer } from '../db/entities/stock-related-peer.entity';
import { CompanyReportRepository } from './company-report.repository';
import { CompanySubsidiaryRepository } from './company-subsidiary.repository';
import { ForeignTradingDailyRepository } from './foreign-trading-daily.repository';
import { InsiderTradingEventRepository } from './insider-trading-event.repository';
import { NewsArticleRepository } from './news-article.repository';
import { StockRelatedPeerRepository } from './stock-related-peer.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ForeignTradingDaily,
      InsiderTradingEvent,
      StockRelatedPeer,
      CompanySubsidiary,
      NewsArticle,
      CompanyReport,
    ]),
  ],
  providers: [
    ForeignTradingDailyRepository,
    InsiderTradingEventRepository,
    StockRelatedPeerRepository,
    CompanySubsidiaryRepository,
    NewsArticleRepository,
    CompanyReportRepository,
  ],
  exports: [
    ForeignTradingDailyRepository,
    InsiderTradingEventRepository,
    StockRelatedPeerRepository,
    CompanySubsidiaryRepository,
    NewsArticleRepository,
    CompanyReportRepository,
  ],
})
export class CompanyDataModule {}

