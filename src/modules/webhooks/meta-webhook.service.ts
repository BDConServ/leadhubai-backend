// src/modules/webhooks/meta-webhook.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }      from '../../prisma/prisma.service';
import { LeadsService }       from '../leads/leads.service';
import { MessagingService }   from '../messaging/messaging.service';
import { FollowUpsService }   from '../follow-ups/follow-ups.service';
import { LeadSource }         from '@prisma/client';
import axios from 'axios';

@Injectable()
export class MetaWebhookService {
  private readonly logger = new Logger(MetaWebhookService.name);

  constructor(
    private readonly prisma:    PrismaService,
    private readonly leads:     LeadsService,
    private readonly messaging: MessagingService,
    private readonly followUps: FollowUpsService,
  ) {}

  async processEvent(body: any): Promise<void> {
    if (!body?.entry?.length) return;

    for (const entry of body.entry) {
      // Lead Ad form submissions
      if (entry.changes?.length) {
        for (const change of entry.changes) {
          if (change.field === 'leadgen') {
            await this.handleLeadAdForm(change.value).catch(e =>
              this.logger.error(`Lead Ad form error: ${e.message}`)
            );
          }
        }
      }
      // Messenger / IG DMs
      if (entry.messaging?.length) {
        for (const event of entry.messaging) {
          if (event.message && !event.message.is_echo) {
            await this.handleDirectMessage(event).catch(e =>
              this.logger.error(`DM error: ${e.message}`)
            );
          }
        }
      }
    }
  }

  // ── FB Lead Ad form ────────────────────────────────────────────────
  private async handleLeadAdForm(value: any): Promise<void> {
    this.logger.log(`Lead Ad form: leadgen_id=${value.leadgen_id}`);

    const formData = await this.fetchLeadFormData(value.leadgen_id);
    if (!formData) return;

    const { name, phone, service } = this.parseFormFields(formData.field_data);
    if (!phone) { this.logger.warn(`No phone for lead ${value.leadgen_id}`); return; }

    const account = await this.prisma.account.findFirst({
      where: { metaPageId: value.page_id },
      include: { phoneNumbers: true },
    });
    if (!account) { this.logger.warn(`No account for page ${value.page_id}`); return; }

    const lead = await this.leads.create({
      name: name || 'Unknown', phone, service, source: LeadSource.FB_FORM,
      accountId: account.id, metaLeadId: value.leadgen_id,
    });

    // Instant reply + schedule follow-ups
    await this.messaging.sendInstantReply(lead.id);
    await this.followUps.scheduleSequence(lead.id);
  }

  // ── Messenger / IG DM ─────────────────────────────────────────────
  private async handleDirectMessage(event: any): Promise<void> {
    const senderId = event.sender.id;
    const text     = event.message?.text ?? '';
    this.logger.log(`DM from PSID ${senderId}: "${text}"`);

    const existing = await this.leads.findByMetaPsid(senderId);
    if (existing) {
      await this.prisma.message.create({
        data: { leadId: existing.id, body: text, direction: 'INBOUND', channel: 'FB_MESSENGER' },
      });
      return;
    }

    // New DM — create placeholder lead and ask for phone
    const account = await this.prisma.account.findFirst({
      where: { metaPageId: event.recipient?.id },
    });
    if (!account) { this.logger.warn(`No account for page ${event.recipient?.id}`); return; }

    const lead = await this.leads.create({
      name: 'Facebook User', phone: '', source: LeadSource.FB_DM,
      accountId: account.id, metaPsid: senderId,
    });

    await this.prisma.message.create({
      data: { leadId: lead.id, body: text, direction: 'INBOUND', channel: 'FB_MESSENGER' },
    });

    await this.sendMessengerReply(
      senderId,
      "Hi! Thanks for reaching out 👋 What's the best phone number to reach you?",
    );
  }

  private async fetchLeadFormData(leadgenId: string): Promise<any> {
    try {
      const res = await axios.get(`https://graph.facebook.com/v19.0/${leadgenId}`, {
        params: { fields: 'field_data,created_time', access_token: process.env.META_ACCESS_TOKEN },
      });
      return res.data;
    } catch (err) {
      this.logger.error(`Meta Graph API error: ${err.message}`);
      return null;
    }
  }

  private parseFormFields(fields: any[]): { name: string; phone: string; service: string } {
    const map: Record<string, string> = {};
    for (const f of fields) map[f.name.toLowerCase()] = f.values?.[0] ?? '';
    return {
      name:    map['full_name'] || map['name'] || '',
      phone:   map['phone_number'] || map['phone'] || map['mobile_number'] || '',
      service: map['service'] || map['what_service_do_you_need'] || '',
    };
  }

  private async sendMessengerReply(psid: string, text: string): Promise<void> {
    try {
      await axios.post('https://graph.facebook.com/v19.0/me/messages',
        { recipient: { id: psid }, message: { text } },
        { params: { access_token: process.env.META_ACCESS_TOKEN } },
      );
    } catch (err) {
      this.logger.error(`Messenger reply failed: ${err.message}`);
    }
  }
}
