// src/modules/accounts/accounts.dto.ts
import { IsString, IsEmail, IsBoolean, IsOptional, MinLength, IsEnum } from 'class-validator';

export enum BusinessType {
  HVAC       = 'hvac',
  ROOFING    = 'roofing',
  MEDSPA     = 'medspa',
  CLEANING   = 'cleaning',
  AUTODETAIL = 'autodetail',
  LAW        = 'law',
  GENERAL    = 'general',
}

export class CreateAccountDto {
  @IsString() @MinLength(2)     name:         string;
  @IsEmail()                    email:        string;
  @IsString() @MinLength(8)     password:     string;
  @IsEnum(BusinessType)         businessType: BusinessType;
  @IsString()  @IsOptional()    metaPageId?:  string;
}

export class UpdateAccountDto {
  @IsString()  @IsOptional()    name?:         string;
  @IsEnum(BusinessType) @IsOptional() businessType?: BusinessType;
  @IsBoolean() @IsOptional()    autoReply?:    boolean;
  @IsString()  @IsOptional()    metaPageId?:   string;
}

export class ToggleAutoReplyDto {
  @IsBoolean() enabled: boolean;
}

export class ToggleAiDto {
  @IsBoolean() enabled: boolean;
}

export class ConnectMetaPageDto {
  @IsString() pageId:       string;
  @IsString() accessToken:  string;
}
