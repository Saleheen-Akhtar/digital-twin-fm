import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';

export class SendCommandDto {
  @IsString()
  @IsIn(['toggle', 'set_value', 'set_mode', 'calibrate'])
  command!: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsString()
  unit?: string;
}
