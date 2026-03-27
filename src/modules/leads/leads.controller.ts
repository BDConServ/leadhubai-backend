// src/modules/leads/leads.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe, HttpCode } from '@nestjs/common';
import { LeadsService }   from './leads.service';
import { CreateLeadDto, UpdateLeadDto, LeadQueryDto } from './leads.dto';
import { JwtAuthGuard }   from '../../common/guards/jwt-auth.guard';
import { CurrentAccount } from '../../common/decorators/current-account.decorator';

@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  findAll(@CurrentAccount() accountId: string, @Query() query: LeadQueryDto) {
    return this.leadsService.findAll(accountId, query);
  }

  @Get('stats')
  getStats(@CurrentAccount() accountId: string) {
    return this.leadsService.getPipelineStats(accountId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentAccount() accountId: string) {
    return this.leadsService.findOne(id, accountId);
  }

  @Post()
  create(@Body() dto: CreateLeadDto, @CurrentAccount() accountId: string) {
    return this.leadsService.create({ ...dto, accountId });
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto, @CurrentAccount() accountId: string) {
    return this.leadsService.update(id, accountId, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentAccount() accountId: string) {
    return this.leadsService.remove(id, accountId);
  }
}
