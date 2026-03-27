// src/modules/ai/prompts/prompt.service.ts
import { Injectable } from '@nestjs/common';

export type MessageIntent = 'GENERAL'|'PRICE'|'BOOKING'|'NOT_INTERESTED'|'STOP';

export interface AiContext {
  leadName:       string;
  businessType:   string;
  inboundMessage: string;
  intent:         MessageIntent;
  recentMessages: { direction: string; body: string }[];
}

@Injectable()
export class PromptService {
  buildSystem(businessType: string): string {
    return `You are a friendly, responsive assistant for a small ${businessType} business.
Your ONLY job is to reply to leads quickly and naturally to move toward booking.

RULES — follow every one:
- Reply in 25 words or fewer. Never exceed this.
- Sound like a real person texting, not a company email.
- Never say "I'm an AI" or anything robotic.
- Never use formal greetings like "Dear" or "Hello there".
- Never write more than one question per reply.
- No bullet points, lists, or paragraphs.
- End with a soft question or a clear next step.

TONE: "Hey! Yes, we do — what time works for you today?"`;
  }

  buildUser(ctx: AiContext): string {
    const history = ctx.recentMessages.length
      ? ctx.recentMessages.map(m => `${m.direction === 'INBOUND' ? 'Lead' : 'Business'}: "${m.body}"`).join('\n')
      : '(no previous messages)';

    const intentMap: Record<MessageIntent, string> = {
      GENERAL:        'Goal: Keep conversation alive. Ask one simple question to learn more or move toward booking.',
      PRICE:          'Goal: Acknowledge without giving a number. Redirect to understanding their needs first.',
      BOOKING:        'Goal: They want to book. Be direct and enthusiastic. Lock in a time.',
      NOT_INTERESTED: 'Goal: Be gracious, leave the door open. One warm sentence. No hard sell.',
      STOP:           "Goal: Acknowledge politely. One sentence max. Don't ask anything.",
    };

    return `Lead name: ${ctx.leadName.split(' ')[0]}

Conversation:
${history}

Latest message: "${ctx.inboundMessage}"

Instruction: ${intentMap[ctx.intent]}

Reply as the business (25 words max, no quotes):`;
  }
}
