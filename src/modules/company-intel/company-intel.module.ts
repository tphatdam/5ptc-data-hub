import { Module } from '@nestjs/common';
import { CompanyDataModule } from '../../company-data/company-data.module';

@Module({
  imports: [CompanyDataModule],
  exports: [CompanyDataModule],
})
export class CompanyIntelModule {}
