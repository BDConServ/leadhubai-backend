// src/modules/ai/ai.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService }   from '../../prisma/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { PromptService, MessageIntent, AiContext } from './prompts/prompt.service';
import { GenerateReplyDto, AiReplyResult } from './dto/ai.dto';

const MAX_CONTEXT_MESSAGES = 5;
const MAX_AUTO_REPLIES     = 3;

const KEYWORD_RULES: { keywords: string[]; intent: MessageIntent }[] = [
  { keywords: ['stop','unsubscribe','quit','cancel','end'],                   intent: 'STOP'           },
  { keywords: ['not interested','no thanks','not looking','nevermind'],       intent: 'NOT_INTERESTED' },
  { keywords: ['price','cost','how much','rate','quote','pricing'],           intent: 'PRICE'          },
  { keywords: ['available','availability','schedule','appointment','book'],   intent: 'BOOKING'        },
];

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly messaging:  MessagingService,
    private readonly prompts:    PromptService,
  ) {}

  // ── Main entry — called by webhook + UI ───────────────────────────
  async generateAndHandleReply(dto: GenerateReplyDto, accountId: string): Promise<AiReplyResult> {
    const lead = await this.prisma.lead.findFirst({
      where:   { id: dto.leadId, accountId },
      include: {
        account:  { include: { phoneNumbers: true } },
        messages: { orderBy: { sentAt: 'desc' }, take: MAX_CONTEXT_MESSAGES },
      },
    });
    if (!lead) throw new BadRequestException(`Lead ${dto.leadId} not found`);

    const intent = this.classifyIntent(dto.inboundMessage);
    this.logger.log(`AI intent for lead ${dto.leadId}: ${intent}`);

    const ctx: AiContext = {
      leadName:       lead.name,
      businessType:   lead.account.businessType,
      inboundMessage: dto.inboundMessage,
      intent,
      recentMessages: lead.messages.reverse().map(m => ({ direction: m.direction, body: m.body })),
    };

    const reply = await this.generateReply(ctx);

    return this.handleReply(reply, dto.leadId, intent, lead.account.autoReply, accountId);
  }

  // ── Generate — calls Claude API ───────────────────────────────────
  async generateReply(ctx: AiContext): Promise<string> {
    if (ctx.intent === 'STOP') return "Got it — we won't reach out again. Take care!";

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 150,
          system:     this.prompts.buildSystem(ctx.businessType),
          messages:   [{ role: 'user', content: this.prompts.buildUser(ctx) }],
        }),
      });

      if (!response.ok) {
        const err: any = await response.json();
        throw new Error(`Claude API ${response.status}: ${err.error?.message}`);
      }

      const data: any = await response.json();
      const raw = data.content?.[0]?.text ?? '';
      return raw.trim().replace(/^["']|["']$/g, '').replace(/\n+/g, ' ').trim();

    } catch (err) {
      this.logger.error(`Claude API failed: ${err.message}`);
      return this.fallback(ctx.intent);
    }
  }

  // ── Handle — auto-send or store as suggestion ──────────────────────
  private async handleReply(
    reply: string, leadId: string, intent: MessageIntent, autoReply: boolean, accountId: string,
  ): Promise<AiReplyResult> {
    const shouldAutoSend = autoReply && (await this.withinLimit(leadId));

    if (shouldAutoSend) {
      await this.messaging.sendMessage({ leadId, body: reply, isAiGenerated: true }, accountId);
      this.logger.log(`Auto-reply sent to lead ${leadId}`);
      return { reply, autoSent: true, suggestion: false, leadId };
    }

    // Store suggestion on the latest inbound message
    await this.prisma.message.updateMany({
      where: { leadId, direction: 'INBOUND', aiSuggestion: null },
      data:  { aiSuggestion: reply },
    });
    return { reply, autoSent: false, suggestion: true, leadId };
  }

  // ── Classify intent — no API needed ───────────────────────────────
  classifyIntent(message: string): MessageIntent {
    const lower = message.toLowerCase().trim();
    for (const rule of KEYWORD_RULES) {
      if (rule.keywords.some(kw => lower.includes(kw))) return rule.intent;
    }
    return 'GENERAL';
  }

  // ── Auto-reply cap — safety limit ────────────────────────────────
  private async withinLimit(leadId: string): Promise<boolean> {
    const count = await this.prisma.message.count({
      where: { leadId, direction: 'OUTBOUND', aiSuggestion: { not: null } },
    });
    return count < MAX_AUTO_REPLIES;
  }

  // ── Fallback if Claude fails ───────────────────────────────────────
  private fallback(intent: MessageIntent): string {
    const map: Record<MessageIntent, string> = {
      GENERAL:        'Thanks for reaching out! Someone will follow up shortly.',
      PRICE:          'Happy to give you pricing info — let me have someone reach out.',
      BOOKING:        "We'd love to book you in! Someone will confirm a time shortly.",
      NOT_INTERESTED: 'No worries at all — reach out if you ever need us!',
      STOP:           "Got it — we won't reach out again. Take care!",
    };
    return map[intent];
  }
}
