import { IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GeneratePdfDto {
  @ApiProperty({
    description: 'Any JSON object to be converted to PDF',
    example: {
      title: 'Sales Report Q4 2024',
      date: '2024-10-16',
      summary: {
        total_sales: 125000,
        total_orders: 453,
      },
    },
  })
  @IsNotEmpty()
  @IsObject()
  report_json: any;
}
