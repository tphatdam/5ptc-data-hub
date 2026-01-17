import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AskAiDto {
  @ApiProperty({
    description: 'The question or prompt to send to the AI',
    example: 'What is the capital of France?',
  })
  @IsNotEmpty()
  @IsString()
  prompt: string;

  @ApiPropertyOptional({
    description: 'ID to continue the conversation',
    example: '',
  })
  @IsOptional()
  @IsString()
  conversationID?: string;
}
