import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OpenAIService } from './services/openai.service';
import { AskAiDto } from './dto/ask-ai.dto';

@ApiTags('AI')
@Controller()
export class AiController {
  constructor(private readonly openAIService: OpenAIService) {}

  @Post('ask')
  @ApiOperation({
    summary: 'Ask AI a question',
    description: 'Send a prompt to the AI service and get a response',
  })
  @ApiResponse({
    status: 200,
    description: 'AI response received successfully',
    schema: {
      type: 'object',
      properties: {
        answers: { description: "The AI's response" },
        conversationID: {
          type: 'string',
          description: 'ID to continue the conversation',
          example: '',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - prompt is required',
  })
  @ApiResponse({
    status: 500,
    description: 'AI service error',
  })
  async ask(@Body() askAiDto: AskAiDto) {
    try {
      const result = await this.openAIService.askOpenAI(
        askAiDto.prompt,
        askAiDto.conversationID || '',
      );

      return {
        answers: result.answers,
        conversationID: result.conversationID,
      };
    } catch (error) {
      console.error('AI endpoint error:', error);
      throw new HttpException(
        {
          error: 'Failed to get AI response',
          message: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
