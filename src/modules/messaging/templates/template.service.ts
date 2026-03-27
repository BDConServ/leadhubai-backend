// src/modules/messaging/templates/template.service.ts
import { Injectable } from '@nestjs/common';

export enum MessageTemplate {
  INSTANT_REPLY    = 'INSTANT_REPLY',
  FOLLOW_UP_1      = 'FOLLOW_UP_1',
  FOLLOW_UP_2      = 'FOLLOW_UP_2',
  FOLLOW_UP_3      = 'FOLLOW_UP_3',
  PRICE_INQUIRY    = 'PRICE_INQUIRY',
  BOOKING_CONFIRM  = 'BOOKING_CONFIRM',
}

type Niche = 'hvac'|'roofing'|'medspa'|'cleaning'|'autodetail'|'law'|'general';

@Injectable()
export class TemplateService {
  render(template: MessageTemplate, ctx: { name: string; service?: string; businessType: string }): string {
    const niche = this.resolveNiche(ctx.businessType);
    const raw   = this.getTemplate(template, niche);
    return raw
      .replace(/\{\{name\}\}/g,    ctx.name?.split(' ')[0] ?? 'there')
      .replace(/\{\{service\}\}/g, ctx.service ?? 'your request');
  }

  private getTemplate(t: MessageTemplate, niche: Niche): string {
    const T: Record<Niche, Record<MessageTemplate, string>> = {
      hvac: {
        [MessageTemplate.INSTANT_REPLY]:   'Hey {{name}}! Got your request for {{service}} — is this urgent or can we schedule later today?',
        [MessageTemplate.FOLLOW_UP_1]:     'Hey {{name}}, just checking — still need help with your {{service}}?',
        [MessageTemplate.FOLLOW_UP_2]:     'We have an opening today — want me to lock in a time for you?',
        [MessageTemplate.FOLLOW_UP_3]:     'Last follow-up — happy to help if you still need it! 🙂',
        [MessageTemplate.PRICE_INQUIRY]:   "Pricing depends on the issue — can I ask what's going on with the system?",
        [MessageTemplate.BOOKING_CONFIRM]: "Perfect! Locked you in. We'll see you then.",
      },
      roofing: {
        [MessageTemplate.INSTANT_REPLY]:   'Hey {{name}}, thanks for reaching out about your roof. Want a quick estimate or schedule an inspection?',
        [MessageTemplate.FOLLOW_UP_1]:     'Just checking in — still looking to get your roof looked at?',
        [MessageTemplate.FOLLOW_UP_2]:     "We're booking inspections this week — want me to reserve a spot?",
        [MessageTemplate.FOLLOW_UP_3]:     'Last follow-up from us — let us know if you still need help!',
        [MessageTemplate.PRICE_INQUIRY]:   'We can give you an honest estimate — no pressure. When works for you?',
        [MessageTemplate.BOOKING_CONFIRM]: "Inspection locked in! We'll be there.",
      },
      medspa: {
        [MessageTemplate.INSTANT_REPLY]:   'Hi {{name}}! Thanks for reaching out — what treatment are you interested in?',
        [MessageTemplate.FOLLOW_UP_1]:     'Just checking in — happy to answer questions or book a consultation 😊',
        [MessageTemplate.FOLLOW_UP_2]:     'We have a few openings this week — want me to reserve a time?',
        [MessageTemplate.FOLLOW_UP_3]:     'Last message from us — here if you need anything!',
        [MessageTemplate.PRICE_INQUIRY]:   'Pricing depends on the treatment — what are you considering?',
        [MessageTemplate.BOOKING_CONFIRM]: "You're booked! Our team will walk you through everything.",
      },
      cleaning: {
        [MessageTemplate.INSTANT_REPLY]:   'Hey {{name}}! Looking for a one-time clean or recurring service?',
        [MessageTemplate.FOLLOW_UP_1]:     'We have availability this week — want me to send pricing or book you in?',
        [MessageTemplate.FOLLOW_UP_2]:     'Just checking — still interested in getting your place cleaned?',
        [MessageTemplate.FOLLOW_UP_3]:     'Last follow-up — reach out anytime if you need us!',
        [MessageTemplate.PRICE_INQUIRY]:   'Pricing depends on the size — how many bedrooms/bathrooms?',
        [MessageTemplate.BOOKING_CONFIRM]: "Locked in! We'll see you then.",
      },
      autodetail: {
        [MessageTemplate.INSTANT_REPLY]:   'Hey {{name}}! Got your request — interior, exterior, or full detail?',
        [MessageTemplate.FOLLOW_UP_1]:     "We've got spots open this week — want me to save one for you?",
        [MessageTemplate.FOLLOW_UP_2]:     'We can come to you or you can drop off — what works better?',
        [MessageTemplate.FOLLOW_UP_3]:     'Last follow-up — happy to help whenever you are ready!',
        [MessageTemplate.PRICE_INQUIRY]:   'Most customers go with full detail — want pricing?',
        [MessageTemplate.BOOKING_CONFIRM]: "Booked! We'll see you then.",
      },
      law: {
        [MessageTemplate.INSTANT_REPLY]:   'Hi {{name}}, thanks for reaching out. Can you briefly share what you need help with?',
        [MessageTemplate.FOLLOW_UP_1]:     'Just checking in — happy to connect you with an attorney to discuss your case.',
        [MessageTemplate.FOLLOW_UP_2]:     'We have availability for a quick call — what time works for you?',
        [MessageTemplate.FOLLOW_UP_3]:     'Last follow-up — here if you need legal guidance.',
        [MessageTemplate.PRICE_INQUIRY]:   "We'll review your situation and guide you on next steps — no obligation.",
        [MessageTemplate.BOOKING_CONFIRM]: "Call confirmed! We'll review your situation and guide you.",
      },
      general: {
        [MessageTemplate.INSTANT_REPLY]:   "Hey {{name}}! Got your message — what's the best time to connect today?",
        [MessageTemplate.FOLLOW_UP_1]:     'Hey {{name}}, just checking in — still interested?',
        [MessageTemplate.FOLLOW_UP_2]:     "We've got a few openings — want me to save you a spot?",
        [MessageTemplate.FOLLOW_UP_3]:     'Last follow-up — happy to help if you still need it!',
        [MessageTemplate.PRICE_INQUIRY]:   'Happy to give you a quick breakdown — what would you like to know?',
        [MessageTemplate.BOOKING_CONFIRM]: "You're all set! Reply if anything changes.",
      },
    };
    return T[niche]?.[t] ?? T.general[t];
  }

  private resolveNiche(bt: string): Niche {
    const b = bt?.toLowerCase() ?? '';
    if (b.includes('hvac') || b.includes('ac') || b.includes('air'))   return 'hvac';
    if (b.includes('roof'))                                             return 'roofing';
    if (b.includes('med') || b.includes('spa') || b.includes('esthe')) return 'medspa';
    if (b.includes('clean'))                                            return 'cleaning';
    if (b.includes('detail') || b.includes('auto'))                    return 'autodetail';
    if (b.includes('law') || b.includes('legal'))                      return 'law';
    return 'general';
  }
}
