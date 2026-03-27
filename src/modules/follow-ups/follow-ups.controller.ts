// src/modules/follow-ups/follow-ups.controller.ts
import { Controller, Get, Post, Delete, Param, Body, ParseUUIDPipe, UseGuards, HttpCode } from '@nestjs/common';
import { FollowUpsService, ScheduleFollowUpDto } from './follow-ups.service';
import { JwtAuthGuard }   from '../../common/guards/jwt-auth.guard';
import { CurrentAccount } from '../../common/decorators/current-account.decorator';

@UseGuards(JwtAuthGuard)
@Controller('follow-ups')
export class FollowUpsController {
  constructor(private readonly followUpsService: FollowUpsService) {}

  @Get('queue/stats')
  getQueueStats() {
    return this.followUpsService.getQueueStats();
  }

  @Get(':leadId')
  getForLead(@Param('leadId', ParseUUIDPipe) leadId: string, @CurrentAccount() accountId: string) {
    return this.followUpsService.getForLead(leadId, accountId);
  }

  @Post()
  scheduleOne(@Body() dto: ScheduleFollowUpDto, @CurrentAccount() accountId: string) {
    return this.followUpsService.scheduleOne(dto, accountId);
  }

  @Delete(':id')
  @HttpCode(200)
  cancelOne(@Param('id', ParseUUIDPipe) id: string, @CurrentAccount() accountId: string) {
    return this.followUpsService.cancelOne(id, accountId);
  }
}
