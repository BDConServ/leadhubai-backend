// src/modules/webhooks/webhooks.module.ts
import { Module }              from '@nestjs/common';
import { WebhooksController }  from './webhooks.controller';
import { MetaWebhookService }  from './meta-webhook.service';
import { TwilioWebhookService } from './twilio-webhook.service';
import { LeadsModule }         from '../leads/leads.module';
import { MessagingModule }     from '../messaging/messaging.module';
import { AiModule }            from '../ai/ai.module';
import { FollowUpsModule }     from '../follow-ups/follow-ups.module';

@Module({
  imports:     [LeadsModule, MessagingModule, AiModule, FollowUpsModule],
  controllers: [WebhooksController],
  providers:   [MetaWebhookService, TwilioWebhookService],
})
export class WebhooksModule {}
