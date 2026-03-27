// src/modules/ai/ai.controller.ts
import { Controller, Post, Get, Body, Param, ParseUUIDPipe, UseGuards, HttpCode } from '@nestjs/common';
import { AiService }          from './ai.service';
import { PrismaService }      from '../../prisma/prisma.service';
import { GenerateReplyDto }   from './dto/ai.dto';
import { JwtAuthGuard }       from '../../common/guards/jwt-auth.guard';
import { AiEnabledGuard }     from '../../common/guards/ai-enabled.guard';
import { CurrentAccount }     from '../../common/decorators/current-account.decorator';
import { PromptService }      from './prompts/prompt.service';

@UseGuards(JwtAuthGuard, AiEnabledGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly ai:      AiService,
    private readonly prisma:  PrismaService,
    private readonly prompts: PromptService,
  ) {}

  // Full flow — generate + auto-send or store as suggestion
  @Post('reply')
  @HttpCode(200)
  generateReply(@Body() dto: GenerateReplyDto, @CurrentAccount() accountId: string) {
    return this.ai.generateAndHandleReply(dto, accountId);
  }

  // Preview only — never auto-sends regardless of account setting
  @Post('suggest')
  @HttpCode(200)
  async suggest(@Body() dto: GenerateReplyDto, @CurrentAccount() accountId: string) {
    const lead = await this.prisma.lead.findFirst({
      where:   { id: dto.leadId, accountId },
      include: { account: true, messages: { orderBy: { sentAt: 'desc' }, take: 5 } },
    });
    if (!lead) return { error: 'Lead not found' };

    const intent = this.ai.classifyIntent(dto.inboundMessage);
    const reply  = await this.ai.generateReply({
      leadName:       lead.name,
      businessType:   lead.account.businessType,
      inboundMessage: dto.inboundMessage,
      intent,
      recentMessages: lead.messages.reverse().map(m => ({ direction: m.direction, body: m.body })),
    });

    return { reply, leadId: dto.leadId, suggestion: true, autoSent: false };
  }

  // Fetch stored suggestion for inbox UI
  @Get(':leadId/suggestion')
  async getSuggestion(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentAccount() accountId: string,
  ) {
    const message = await this.prisma.message.findFirst({
      where:   { leadId, lead: { accountId }, direction: 'INBOUND', aiSuggestion: { not: null } },
      orderBy: { sentAt: 'desc' },
    });
    return { leadId, suggestion: message?.aiSuggestion ?? null, messageId: message?.id ?? null };
  }
}
