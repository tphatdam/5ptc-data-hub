import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { OpenAIService } from './services/openai.service';
import { OpenAIClientProvider } from './providers/openai-client.provider';

@Module({
  controllers: [AiController],
  providers: [OpenAIClientProvider, OpenAIService],
  exports: [OpenAIService],
})
export class AiModule {}
