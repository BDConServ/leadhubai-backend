// src/modules/follow-ups/follow-ups.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue }     from '@nestjs/bullmq';
import { Queue }           from 'bullmq';
import { PrismaService }   from '../../prisma/prisma.service';
import { TemplateService, MessageTemplate } from '../messaging/templates/template.service';
import { IsUUID, IsString, IsDateString } from 'class-validator';

// ── Exported constants — used by module, processor, and controller ─
export const FOLLOW_UP_QUEUE = 'follow-ups';

export class ScheduleFollowUpDto {
  @IsUUID()        leadId:      string;
  @IsString()      body:        string;
  @IsDateString()  scheduledAt: string;
}

export interface FollowUpJobData {
  followUpId:    string;
  leadId:        string;
  accountId:     string;
  attemptNumber: number;
}

const SEQUENCE = [
  { number: 1, delayDays: 1, templateKey: 'FOLLOW_UP_1' },
  { number: 2, delayDays: 3, templateKey: 'FOLLOW_UP_2' },
  { number: 3, delayDays: 5, templateKey: 'FOLLOW_UP_3' },
];

@Injectable()
export class FollowUpsService {
  private readonly logger = new Logger(FollowUpsService.name);

  constructor(
    @InjectQueue(FOLLOW_UP_QUEUE) private readonly queue: Queue,
    private readonly prisma:     PrismaService,
    private readonly templates:  TemplateService,
  ) {}

  // ── Schedule full 3-step sequence ─────────────────────────────────
  async scheduleSequence(leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findUnique({
      where:   { id: leadId },
      include: { account: { select: { id: true, businessType: true } } },
    });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);

    await this.cancelForLead(leadId);

    const now = new Date();
    for (const step of SEQUENCE) {
      const fireAt  = new Date(now);
      fireAt.setDate(fireAt.getDate() + step.delayDays);
      const delayMs = fireAt.getTime() - now.getTime();

      const body = this.templates.render(
        MessageTemplate[step.templateKey as keyof typeof MessageTemplate],
        { name: lead.name, service: lead.service ?? undefined, businessType: lead.account.businessType },
      );

      const fu = await this.prisma.followUp.create({
        data: { leadId, body, scheduledAt: fireAt, status: 'PENDING' },
      });

      const job = await this.queue.add(
        `follow-up-${step.number}`,
        { followUpId: fu.id, leadId, accountId: lead.account.id, attemptNumber: step.number } as FollowUpJobData,
        { delay: delayMs, jobId: `${leadId}-fu-${step.number}` },
      );

      await this.prisma.followUp.update({ where: { id: fu.id }, data: { jobId: job.id?.toString() } });
      this.logger.log(`Follow-up #${step.number} scheduled for lead ${leadId} — fires in ${step.delayDays}d`);
    }
  }

  // ── Cancel all pending follow-ups for a lead ───────────────────────
  async cancelForLead(leadId: string): Promise<number> {
    const pending = await this.prisma.followUp.findMany({ where: { leadId, status: 'PENDING' } });
    if (!pending.length) return 0;

    for (const fu of pending) {
      if (fu.jobId) {
        try {
          const job = await this.queue.getJob(fu.jobId);
          if (job) await job.remove();
        } catch { /* job may have already fired */ }
      }
    }

    await this.prisma.followUp.updateMany({ where: { leadId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    this.logger.log(`Cancelled ${pending.length} follow-ups for lead ${leadId}`);
    return pending.length;
  }

  // ── Schedule a single manual follow-up ────────────────────────────
  async scheduleOne(dto: ScheduleFollowUpDto, accountId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id: dto.leadId, accountId } });
    if (!lead) throw new NotFoundException(`Lead ${dto.leadId} not found`);

    const fireAt = new Date(dto.scheduledAt);
    if (fireAt <= new Date()) throw new BadRequestException('scheduledAt must be in the future');

    const fu  = await this.prisma.followUp.create({
      data: { leadId: dto.leadId, body: dto.body, scheduledAt: fireAt, status: 'PENDING' },
    });
    const job = await this.queue.add('follow-up-manual',
      { followUpId: fu.id, leadId: dto.leadId, accountId, attemptNumber: 0 } as FollowUpJobData,
      { delay: fireAt.getTime() - Date.now() },
    );
    await this.prisma.followUp.update({ where: { id: fu.id }, data: { jobId: job.id?.toString() } });
    return fu;
  }

  // ── Cancel a single follow-up ──────────────────────────────────────
  async cancelOne(id: string, accountId: string): Promise<void> {
    const fu = await this.prisma.followUp.findFirst({
      where:   { id },
      include: { lead: { select: { accountId: true } } },
    });
    if (!fu) throw new NotFoundException(`Follow-up ${id} not found`);
    if (fu.lead.accountId !== accountId) throw new BadRequestException('Not your follow-up');
    if (fu.status !== 'PENDING') throw new BadRequestException(`Cannot cancel status: ${fu.status}`);

    if (fu.jobId) {
      const job = await this.queue.getJob(fu.jobId);
      if (job) await job.remove();
    }
    await this.prisma.followUp.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  // ── List for a lead ───────────────────────────────────────────────
  async getForLead(leadId: string, accountId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, accountId } });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);
    return this.prisma.followUp.findMany({ where: { leadId }, orderBy: { scheduledAt: 'asc' } });
  }

  // ── Queue health stats ────────────────────────────────────────────
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(), this.queue.getActiveCount(),
      this.queue.getCompletedCount(), this.queue.getFailedCount(), this.queue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }
}
