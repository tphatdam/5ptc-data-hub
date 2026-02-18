import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIClientProvider } from '../providers/openai-client.provider';

interface AIResponse {
  answers: string;
  conversationID: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class OpenAIService {
  private conversationHistories: Map<string, ChatMessage[]> = new Map();
  // External AI endpoint (optional). If not configured, service will use official OpenAI directly.
  private readonly externalApiUrl?: string;
  private readonly externalApiEnabled: boolean;
  private readonly externalRequestTimeoutMs: number;

  constructor(
    private configService: ConfigService,
    private openaiClientProvider: OpenAIClientProvider,
  ) {
    // Read external AI configuration; do NOT default to a hardcoded third-party URL.
    // If OPENAI_API_URL is absent, external AI is considered disabled and we will
    // use the official OpenAI API directly for stability.
    this.externalApiUrl = this.configService.get<string>('OPENAI_API_URL') || undefined;
    this.externalApiEnabled = !!this.externalApiUrl;
    // Allow overriding fetch timeout via env; default to 60s for slow providers.
    const timeoutStr = this.configService.get<string>('EXTERNAL_AI_TIMEOUT_MS');
    this.externalRequestTimeoutMs = timeoutStr ? Number(timeoutStr) : 60000;
  }

  private getConversationHistory(conversationID: string): ChatMessage[] {
    if (!conversationID) return [];
    if (!this.conversationHistories.has(conversationID)) {
      this.conversationHistories.set(conversationID, []);
    }
    return this.conversationHistories.get(conversationID) || [];
  }

  private addToConversationHistory(
    conversationID: string,
    userPrompt: string,
    aiResponse: string | any,
  ): void {
    if (!conversationID) return;
    const history = this.getConversationHistory(conversationID);

    const responseContent =
      typeof aiResponse === 'object'
        ? JSON.stringify(aiResponse)
        : String(aiResponse);

    history.push(
      { role: 'user', content: userPrompt },
      { role: 'assistant', content: responseContent },
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async askOpenAIWithRetry(
    prompt: string,
    conversationID: string = '',
    maxRetries: number = 1,
  ): Promise<AIResponse> {
    let lastError: Error = new Error('Unknown error');

    // If external AI is not configured, use official OpenAI immediately.
    if (!this.externalApiEnabled) {
      strapi.log.info('External AI not configured; using OpenAI official API directly.');
      return await this.askOpenAIOfficial(prompt, conversationID);
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        strapi.log.info(`External AI API attempt ${attempt}/${maxRetries}...`);
        const result = await this.askOpenAI(prompt, conversationID);
        strapi.log.info(`✓ External AI API attempt ${attempt} succeeded`);

        this.addToConversationHistory(
          result.conversationID,
          prompt,
          result.answers,
        );

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;
        console.error(`✗ External AI API attempt ${attempt} failed: ${err.message}`);
        // If connect timeout occurs, fallback immediately to official API when available.
        const message = String(err.message || '').toUpperCase();
        const isConnectTimeout = message.includes('UND_ERR_CONNECT_TIMEOUT') || message.includes('FETCH FAILED');
        if (isConnectTimeout && this.configService.get<string>('OPENAI_API_KEY')) {
          strapi.log.info('Network/connect timeout detected; falling back to OpenAI official API.');
          try {
            const result = await this.askOpenAIOfficial(prompt, conversationID);
            strapi.log.info('✓ OpenAI official API fallback succeeded');
            this.addToConversationHistory(result.conversationID, prompt, result.answers);
            return result;
          } catch (fallbackError: any) {
            console.error(
              '✗ OpenAI official API fallback also failed:',
              fallbackError?.message || String(fallbackError),
            );
            throw new Error(
              `All API attempts failed. External: ${lastError.message}, OpenAI fallback: ${fallbackError?.message || String(fallbackError)}`,
            );
          }
        }

        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          strapi.log.info(`Retrying in ${delayMs}ms...`);
          await this.sleep(delayMs);
        }
      }
    }

    if (this.configService.get<string>('OPENAI_API_KEY')) {
      try {
        strapi.log.info(
          '⚠ External API failed - trying OpenAI official API as fallback...',
        );
        const result = await this.askOpenAIOfficial(prompt, conversationID);
        strapi.log.info('✓ OpenAI official API fallback succeeded');

        this.addToConversationHistory(
          result.conversationID,
          prompt,
          result.answers,
        );

        return result;
      } catch (fallbackError: any) {
        console.error(
          '✗ OpenAI official API fallback also failed:',
          fallbackError?.message || String(fallbackError),
        );
        throw new Error(
          `All API attempts failed. External: ${lastError.message}, OpenAI fallback: ${fallbackError?.message || String(fallbackError)}`,
        );
      }
    }

    throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  async askOpenAI(
    prompt: string,
    conversationID: string = '',
  ): Promise<AIResponse> {
    if (!this.externalApiEnabled || !this.externalApiUrl) {
      throw new Error('External AI is not configured');
    }
    const payload = {
      prompt: prompt,
      proxy: '',
      timeout: 60,
      model: 'gpt-5-instant',
      mode: 'copilot',
      conversationID: conversationID,
      keepContext: conversationID ? true : false,
    };

    try {
      const response = await fetch(this.externalApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.externalRequestTimeoutMs),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const responseText = await response.text();

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (jsonError: any) {
        console.error(
          'Failed to parse API response as JSON:',
          jsonError.message,
        );
        console.error(
          'Response body (first 500 chars):',
          responseText.substring(0, 500),
        );
        throw new Error(
          `Invalid JSON response from API: ${jsonError.message}`,
        );
      }

      if (!result.success) {
        throw new Error(result.message || 'API request was not successful');
      }

      if (!result.data || !result.data.answers) {
        throw new Error('No answer received from AI service');
      }

      return {
        answers: result.data.answers,
        conversationID: result.data.conversationID || '',
      };
    } catch (error: any) {
      // Enhance logging to include endpoint and error cause for easier diagnostics.
      console.error('OpenAI Service Error:', {
        endpoint: this.externalApiUrl,
        timeoutMs: this.externalRequestTimeoutMs,
        error,
      });
      const causeCode = (error as any)?.cause?.code || '';
      const causeMessage = (error as any)?.cause?.message || '';
      throw new Error(
        `Failed to get response from AI: ${error.message}${causeCode ? ` (cause: ${causeCode} ${causeMessage})` : ''}`,
      );
    }
  }

  async askOpenAIOfficial(
    prompt: string,
    conversationID: string = '',
  ): Promise<AIResponse> {
    const client = this.openaiClientProvider.getClient();

    if (!client) {
      throw new Error(
        'OpenAI client not available - OPENAI_API_KEY not set',
      );
    }

    try {
      if (!conversationID) {
        conversationID = `openai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      const history = this.getConversationHistory(conversationID);
      const messages: any[] = [
        ...history,
        {
          role: 'user',
          content: prompt,
        },
      ];

      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 4000,
      });

      if (!completion.choices || completion.choices.length === 0) {
        throw new Error('No response from OpenAI API');
      }

      return {
        answers: completion.choices[0].message.content || '',
        conversationID: conversationID,
      };
    } catch (error: any) {
      console.error('OpenAI Official API Error:', error);
      throw new Error(`Failed to get response from OpenAI: ${error.message}`);
    }
  }
}
