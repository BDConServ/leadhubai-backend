// src/modules/ai/dto/ai.dto.ts
import { IsUUID, IsString } from 'class-validator';

export class GenerateReplyDto {
  @IsUUID()   leadId:         string;
  @IsString() inboundMessage: string;
}

export type MessageIntent = 'GENERAL' | 'PRICE' | 'BOOKING' | 'NOT_INTERESTED' | 'STOP';

export interface AiReplyResult {
  reply:      string;
  autoSent:   boolean;
  suggestion: boolean;
  leadId:     string;
}
