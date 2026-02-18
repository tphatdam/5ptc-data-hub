import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAIClientProvider {
  private openaiClient: OpenAI | null = null;

  constructor(private configService: ConfigService) {}

  getClient(): OpenAI | null {
    if (!this.openaiClient) {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      if (apiKey) {
        this.openaiClient = new OpenAI({ apiKey });
      }
    }
    return this.openaiClient;
  }

  isAvailable(): boolean {
    return this.getClient() !== null;
  }
}
