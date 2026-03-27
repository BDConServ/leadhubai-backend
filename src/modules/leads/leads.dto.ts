// src/modules/leads/leads.dto.ts
import { IsString, IsEmail, IsOptional, IsEnum, IsUUID, MinLength } from 'class-validator';
import { LeadSource, LeadStatus } from '@prisma/client';

export class CreateLeadDto {
  @IsString() @MinLength(1)   name:       string;
  @IsString()                 phone:      string;
  @IsEmail()    @IsOptional() email?:     string;
  @IsString()   @IsOptional() service?:   string;
  @IsEnum(LeadSource)         source:     LeadSource;
  @IsUUID()                   accountId:  string;
  @IsString()   @IsOptional() metaLeadId?: string;
  @IsString()   @IsOptional() metaPsid?:  string;
}

export class UpdateLeadDto {
  @IsEnum(LeadStatus) @IsOptional() status?:  LeadStatus;
  @IsString()         @IsOptional() notes?:   string;
  @IsString()         @IsOptional() service?: string;
  @IsString()         @IsOptional() name?:    string;
  @IsString()         @IsOptional() phone?:   string;
}

export class LeadQueryDto {
  @IsEnum(LeadStatus) @IsOptional() status?:  LeadStatus;
  @IsEnum(LeadSource) @IsOptional() source?:  LeadSource;
  @IsString()         @IsOptional() search?:  string;
}
