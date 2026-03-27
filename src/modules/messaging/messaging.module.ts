// src/modules/messaging/messaging.module.ts
import { Module }              from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { MessagingService }    from './messaging.service';
import { TwilioService }       from './twilio.service';
import { TemplateService }     from './templates/template.service';
import { LeadsModule }         from '../leads/leads.module';

@Module({
  imports:     [LeadsModule],
  controllers: [MessagingController],
  providers:   [MessagingService, TwilioService, TemplateService],
  exports:     [MessagingService, TwilioService, TemplateService],
})
export class MessagingModule {}
