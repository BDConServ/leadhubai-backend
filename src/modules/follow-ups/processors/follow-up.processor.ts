// src/modules/follow-ups/processors/follow-up.processor.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job }    from 'bullmq';
import { MessagingService }  from '../../messaging/messaging.service';
import { PrismaService }     from '../../../prisma/prisma.service';
import { FOLLOW_UP_QUEUE, FollowUpJobData } from '../follow-ups.service';

@Processor(FOLLOW_UP_QUEUE, { concurrency: 5 })
export class FollowUpProcessor extends WorkerHost {
  private readonly logger = new Logger(FollowUpProcessor.name);

  constructor(
    private readonly messaging: MessagingService,
    private readonly prisma:    PrismaService,
  ) { super(); }

  async process(job: Job<FollowUpJobData>): Promise<void> {
    const { followUpId, leadId } = job.data;
    this.logger.log(`Processing follow-up job ${job.id} — followUp: ${followUpId}`);

    const fu = await this.prisma.followUp.findUnique({ where: { id: followUpId } });
    if (!fu)                     { this.logger.warn(`Follow-up ${followUpId} not found`); return; }
    if (fu.status !== 'PENDING') { this.logger.log(`Follow-up ${followUpId} is ${fu.status} — skipping`); return; }

    await this.messaging.sendFollowUp(followUpId);
    this.logger.log(`Follow-up job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<FollowUpJobData>, error: Error) {
    const { followUpId } = job.data;
    this.logger.error(`Job ${job.id} failed (attempt ${job.attemptsMade}): ${error.message}`);
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      await this.prisma.followUp.update({ where: { id: followUpId }, data: { status: 'FAILED' } })
        .catch(e => this.logger.error(`Could not mark FAILED: ${e.message}`));
    }
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(`Job ${jobId} stalled — BullMQ will re-queue`);
  }
}
