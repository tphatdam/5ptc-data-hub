import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";

export class GenerateReportDto {
  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({ type: "string" })
  email: string;
}
