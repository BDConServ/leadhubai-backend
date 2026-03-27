// src/modules/messaging/messaging.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService }   from '../../prisma/prisma.service';
import { TwilioService }   from './twilio.service';
import { TemplateService, MessageTemplate } from './templates/template.service';
import { LeadsService }    from '../leads/leads.service';
import { MessageDirection, MessageChannel, LeadStatus } from '@prisma/client';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma:    PrismaService,
    private readonly twilio:    TwilioService,
    private readonly templates: TemplateService,
    private readonly leads:     LeadsService,
  ) {}

  // ── Instant reply — called after lead created ─────────────────────
  async sendInstantReply(leadId: string): Promise<void> {
    const lead = await this.getLeadWithAccount(leadId);
    if (!lead.phone) { this.logger.warn(`Lead ${leadId} has no phone`); return; }

    const fromNumber = this.resolveFrom(lead);
    const body = this.templates.render(MessageTemplate.INSTANT_REPLY, {
      name: lead.name, service: lead.service ?? undefined, businessType: lead.account.businessType,
    });

    await this.sendAndSave({ lead, fromNumber, body });
    await this.leads.updateStatus(leadId, LeadStatus.CONTACTED);
    this.logger.log(`Instant reply sent to lead ${leadId}`);
  }

  // ── Manual send from inbox UI ─────────────────────────────────────
  async sendMessage(dto: { leadId: string; body: string; isAiGenerated?: boolean }, accountId: string) {
    const lead = await this.getLeadWithAccount(dto.leadId);
    if (lead.accountId !== accountId) throw new BadRequestException('Lead does not belong to this account');
    if (!lead.phone) throw new BadRequestException('Lead has no phone number');
    const fromNumber = this.resolveFrom(lead);
    return this.sendAndSave({ lead, fromNumber, body: dto.body, isAiGenerated: dto.isAiGenerated });
  }

  // ── Follow-up send — called by BullMQ worker ──────────────────────
  async sendFollowUp(followUpId: string): Promise<void> {
    const fu = await this.prisma.followUp.findUnique({
      where:   { id: followUpId },
      include: { lead: { include: { account: { include: { phoneNumbers: true } } } } },
    });
    if (!fu) { this.logger.warn(`FollowUp ${followUpId} not found`); return; }

    const skipStatuses = [LeadStatus.REPLIED, LeadStatus.QUALIFIED, LeadStatus.BOOKED, LeadStatus.CLOSED] as string[];
    if (skipStatuses.includes(fu.lead.status)) {
      await this.prisma.followUp.update({ where: { id: followUpId }, data: { status: 'CANCELLED' } });
      this.logger.log(`Follow-up ${followUpId} skipped — lead status: ${fu.lead.status}`);
      return;
    }

    const fromNumber = this.resolveFrom(fu.lead);
    try {
      const sid = await this.twilio.sendSms({ to: fu.lead.phone, from: fromNumber, body: fu.body });
      await this.prisma.message.create({
        data: { leadId: fu.leadId, body: fu.body, direction: MessageDirection.OUTBOUND, channel: MessageChannel.SMS, twilioSid: sid },
      });
      await this.prisma.followUp.update({ where: { id: followUpId }, data: { status: 'SENT', sentAt: new Date() } });
      this.logger.log(`Follow-up ${followUpId} sent`);
    } catch (err) {
      await this.prisma.followUp.update({ where: { id: followUpId }, data: { status: 'FAILED' } });
      this.logger.error(`Follow-up ${followUpId} failed: ${err.message}`);
    }
  }

  // ── Get thread ────────────────────────────────────────────────────
  async getThread(leadId: string, accountId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, accountId } });
    if (!lead) throw new BadRequestException('Lead not found');
    return this.prisma.message.findMany({ where: { leadId }, orderBy: { sentAt: 'asc' } });
  }

  // ── Core send + save ──────────────────────────────────────────────
  private async sendAndSave(p: { lead: any; fromNumber: string; body: string; isAiGenerated?: boolean }) {
    if (p.lead.status === LeadStatus.CLOSED) throw new BadRequestException('Cannot send to closed lead');

    const sid = await this.twilio.sendSms({ to: p.lead.phone, from: p.fromNumber, body: p.body });

    const message = await this.prisma.message.create({
      data: {
        leadId:    p.lead.id,
        body:      p.body,
        direction: MessageDirection.OUTBOUND,
        channel:   MessageChannel.SMS,
        twilioSid: sid,
        ...(p.isAiGenerated && { aiSuggestion: p.body }),
      },
    });

    await this.prisma.lead.update({ where: { id: p.lead.id }, data: { updatedAt: new Date() } });
    return message;
  }

  private resolveFrom(lead: any): string {
    const number = lead.account?.phoneNumbers?.[0]?.number;
    if (!number) throw new BadRequestException(`Account ${lead.accountId} has no phone number`);
    return number;
  }

  private async getLeadWithAccount(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where:   { id: leadId },
      include: { account: { include: { phoneNumbers: true } } },
    });
    if (!lead) throw new BadRequestException(`Lead ${leadId} not found`);
    return lead;
  }
}
