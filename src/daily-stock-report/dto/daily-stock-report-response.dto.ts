import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class DailyStockReportResponseDto {
  @ApiProperty({ type: "string", description: "Stock code" })
  stockCode: string;

  @ApiProperty({ type: "string", description: "Report date in YYYY-MM-DD format" })
  reportDate: string;

  @ApiProperty({ type: "string", nullable: true, description: "URL to the PDF report" })
  pdfUrl: string | null;

  @ApiProperty({
    type: "string",
    enum: ["Giữ", "Mua", "Bán"],
    nullable: true,
    description: "Investment recommendation",
  })
  investmentRecommendation: "Giữ" | "Mua" | "Bán" | null;

  @ApiPropertyOptional({
    type: "string",
    enum: ["PENDING", "READY"],
    description: "Report status - PENDING if report is being generated, READY if available",
  })
  status?: "PENDING" | "READY";
}
