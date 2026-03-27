import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import { Plan } from '@prisma/client';

// DTO = Data Transfer Object — defines what data the API expects to receive

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  businessName: string;

  @IsString()
  @IsNotEmpty()
  ownerName: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsUrl()
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsEnum(Plan)
  @IsOptional()
  plan?: Plan;
}
