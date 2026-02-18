import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateStockReportDto {
  @ApiProperty({
    description: 'The stock code to analyze (e.g., VNM, VIC, VHM)',
    example: 'VNM',
  })
  @IsNotEmpty()
  @IsString()
  stock_code: string;
}
