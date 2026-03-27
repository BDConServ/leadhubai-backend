import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsBoolean()
  @IsOptional()
  aiResponseEnabled?: boolean;

  @IsInt()
  @Min(0)
  @Max(300)
  @IsOptional()
  responseDelaySeconds?: number;

  @IsBoolean()
  @IsOptional()
  notifyEmail?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyPhone?: boolean;

  @IsString()
  @IsOptional()
  businessHours?: string;

  @IsString()
  @IsOptional()
  aiGreeting?: string;
}
