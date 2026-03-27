// src/modules/messaging/messaging.controller.ts
import { Controller, Post, Get, Body, Param, ParseUUIDPipe, UseGuards, HttpCode } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { IsString, IsUUID, IsBoolean, IsOptional } from 'class-validator';
import { JwtAuthGuard }     from '../../common/guards/jwt-auth.guard';
import { CurrentAccount }   from '../../common/decorators/current-account.decorator';

class SendMessageDto {
  @IsUUID()   leadId:         string;
  @IsString() body:           string;
  @IsBoolean() @IsOptional() isAiGenerated?: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('send')
  @HttpCode(200)
  send(@Body() dto: SendMessageDto, @CurrentAccount() accountId: string) {
    return this.messagingService.sendMessage(dto, accountId);
  }

  @Get(':leadId/thread')
  getThread(@Param('leadId', ParseUUIDPipe) leadId: string, @CurrentAccount() accountId: string) {
    return this.messagingService.getThread(leadId, accountId);
  }
}
