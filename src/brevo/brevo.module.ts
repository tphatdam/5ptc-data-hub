import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BrevoService } from './brevo.service';
import { BrevoController } from './brevo.controller';

@Module({
  imports: [ConfigModule],
  controllers: [BrevoController],
  providers: [BrevoService],
  exports: [BrevoService],
})
export class BrevoModule {}
