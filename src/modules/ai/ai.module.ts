// src/modules/ai/ai.module.ts
import { Module }          from '@nestjs/common';
import { AiController }    from './ai.controller';
import { AiService }       from './ai.service';
import { PromptService }   from './prompts/prompt.service';
import { MessagingModule } from '../messaging/messaging.module';
import { LeadsModule }     from '../leads/leads.module';

@Module({
  imports:     [MessagingModule, LeadsModule],
  controllers: [AiController],
  providers:   [AiService, PromptService],
  exports:     [AiService],
})
export class AiModule {}
