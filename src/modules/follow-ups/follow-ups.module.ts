// src/modules/follow-ups/follow-ups.module.ts
import { Module }            from '@nestjs/common';
import { BullModule }        from '@nestjs/bullmq';
import { FollowUpsService, FOLLOW_UP_QUEUE }  from './follow-ups.service';
import { FollowUpsController } from './follow-ups.controller';
import { FollowUpProcessor } from './processors/follow-up.processor';
import { MessagingModule }   from '../messaging/messaging.module';
import { LeadsModule }       from '../leads/leads.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: FOLLOW_UP_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff:  { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail:     200,
      },
    }),
    MessagingModule,
    LeadsModule,
  ],
  controllers: [FollowUpsController],
  providers:   [FollowUpsService, FollowUpProcessor],
  exports:     [FollowUpsService],
})
export class FollowUpsModule {}
