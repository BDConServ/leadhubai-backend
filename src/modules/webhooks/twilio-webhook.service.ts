// src/modules/webhooks/twilio-webhook.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }      from '../../prisma/prisma.service';
import { LeadsService }       from '../leads/leads.service';
import { AiService }          from '../ai/ai.service';
import { FollowUpsService }   from '../follow-ups/follow-ups.service';
import { LeadStatus, MessageDirection, MessageChannel } from '@prisma/client';
import { TwilioInboundPayload } from './webhooks.controller';

const STOP_KEYWORDS = ['stop','unsubscribe','cancel','quit','end'];

@Injectable()
export class TwilioWebhookService {
  private readonly logger = new Logger(TwilioWebhookService.name);

  constructor(
    private readonly prisma:    PrismaService,
    private readonly leads:     LeadsService,
    private readonly ai:        AiService,
    private readonly followUps: FollowUpsService,
  ) {}

  async processInboundSms(payload: TwilioInboundPayload): Promise<void> {
    const { From, Body, MessageSid } = payload;
    const lower = Body.trim().toLowerCase();
    this.logger.log(`Inbound SMS from ${From}: "${Body}"`);

    // Find lead by phone
    const lead = await this.leads.findByPhone(From);
    if (!lead) { this.logger.warn(`No lead for ${From}`); return; }

    // Handle STOP
    if (STOP_KEYWORDS.some(kw => lower === kw || lower.startsWith(kw + ' '))) {
      await this.handleOptOut(lead.id);
      return;
    }

    // Save inbound message
    await this.prisma.message.create({
      data: { leadId: lead.id, body: Body, direction: MessageDirection.INBOUND,
               channel: MessageChannel.SMS, twilioSid: MessageSid },
    });

    // Update lead status
    if (([LeadStatus.NEW, LeadStatus.CONTACTED] as string[]).includes(lead.status)) {
      await this.leads.updateStatus(lead.id, LeadStatus.REPLIED);
    }

    // Cancel pending follow-ups — lead replied, stop chasing
    await this.followUps.cancelForLead(lead.id);

    // Only generate AI reply if account has AI enabled (Growth / Pro plan)
    if (lead.account?.aiEnabled) {
      await this.ai.generateAndHandleReply(
        { leadId: lead.id, inboundMessage: Body },
        lead.accountId,
      );
    }
  }

  private async handleOptOut(leadId: string): Promise<void> {
    this.logger.log(`STOP received — closing lead ${leadId}`);
    await this.prisma.$transaction([
      this.prisma.lead.update({ where: { id: leadId }, data: { status: LeadStatus.CLOSED } }),
      this.prisma.followUp.updateMany({ where: { leadId, status: 'PENDING' }, data: { status: 'CANCELLED' } }),
    ]);
  }
}
