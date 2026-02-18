import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuoteDaily } from '../../db/entities/quote-daily.entity';
import { QuoteIntraday } from '../../db/entities/quote-intraday.entity';
import { QuoteDailyRepository } from './quote-daily.repository';
import { QuoteIntradayRepository } from './quote-intraday.repository';

@Module({
  imports: [TypeOrmModule.forFeature([QuoteDaily, QuoteIntraday])],
  providers: [QuoteDailyRepository, QuoteIntradayRepository],
  exports: [QuoteDailyRepository, QuoteIntradayRepository],
})
export class QuotesModule {}
