// src/modules/leads/leads.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LeadStatus, LeadSource } from '@prisma/client';
import { CreateLeadDto, UpdateLeadDto, LeadQueryDto } from './leads.dto';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Create (with deduplication) ───────────────────────────────────
  async create(dto: CreateLeadDto) {
    const existing = await this.prisma.lead.findFirst({ where: { phone: dto.phone, accountId: dto.accountId } });
    if (existing) { this.logger.log(`Duplicate lead ${dto.phone} — returning existing`); return existing; }

    if (dto.metaLeadId) {
      const metaDupe = await this.prisma.lead.findUnique({ where: { metaLeadId: dto.metaLeadId } });
      if (metaDupe) { this.logger.log(`Duplicate metaLeadId — skipping`); return metaDupe; }
    }

    const lead = await this.prisma.lead.create({
      data: { name: dto.name, phone: dto.phone, email: dto.email, service: dto.service,
               source: dto.source, status: LeadStatus.NEW, accountId: dto.accountId,
               metaLeadId: dto.metaLeadId, metaPsid: dto.metaPsid },
    });
    this.logger.log(`Lead created: ${lead.id} (${lead.name})`);
    return lead;
  }

  // ── List — inbox sidebar ───────────────────────────────────────────
  async findAll(accountId: string, query: LeadQueryDto) {
    const where: any = { accountId };
    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;
    if (query.search) where.OR = [
      { name:  { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search } },
    ];

    const leads = await this.prisma.lead.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        messages:  { orderBy: { sentAt: 'desc' }, take: 1 },
        followUps: { where: { status: 'PENDING' }, orderBy: { scheduledAt: 'asc' }, take: 1 },
        _count:    { select: { messages: true } },
      },
    });

    return leads.map(l => ({
      id:                   l.id,
      name:                 l.name,
      phone:                l.phone,
      service:              l.service,
      source:               l.source,
      status:               l.status,
      lastMessage:          l.messages[0]?.body ?? null,
      lastMessageAt:        l.messages[0]?.sentAt ?? l.createdAt,
      lastMessageDirection: l.messages[0]?.direction ?? null,
      nextFollowUp:         l.followUps[0]?.scheduledAt ?? null,
      messageCount:         l._count.messages,
      createdAt:            l.createdAt,
    }));
  }

  // ── Get one — chat panel ───────────────────────────────────────────
  async findOne(id: string, accountId: string) {
    const lead = await this.prisma.lead.findFirst({
      where:   { id, accountId },
      include: {
        messages:  { orderBy: { sentAt: 'asc' } },
        followUps: { orderBy: { scheduledAt: 'asc' } },
        account:   { select: { name: true, businessType: true, autoReply: true } },
      },
    });
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  // ── Update ────────────────────────────────────────────────────────
  async update(id: string, accountId: string, dto: UpdateLeadDto) {
    await this.assertExists(id, accountId);
    return this.prisma.lead.update({
      where: { id },
      data: {
        ...(dto.status  && { status:  dto.status  }),
        ...(dto.notes   !== undefined && { notes:   dto.notes   }),
        ...(dto.service && { service: dto.service }),
        ...(dto.name    && { name:    dto.name    }),
        ...(dto.phone   && { phone:   dto.phone   }),
      },
    });
  }

  // ── Update status (called by other modules) ────────────────────────
  async updateStatus(id: string, status: LeadStatus) {
    return this.prisma.lead.update({ where: { id }, data: { status } });
  }

  // ── Find by phone (Twilio webhook) ────────────────────────────────
  async findByPhone(phone: string, accountId?: string) {
    return this.prisma.lead.findFirst({
      where: { phone, ...(accountId && { accountId }) },
      include: {
        account:   { include: { phoneNumbers: true } },  // aiEnabled comes through here
        messages:  { orderBy: { sentAt: 'desc' }, take: 5 },
        followUps: { where: { status: 'PENDING' } },
      },
    });
  }

  // ── Find by Meta PSID (DM webhook) ────────────────────────────────
  async findByMetaPsid(psid: string) {
    return this.prisma.lead.findUnique({ where: { metaPsid: psid } });
  }

  // ── Pipeline stats ─────────────────────────────────────────────────
  async getPipelineStats(accountId: string) {
    const counts = await this.prisma.lead.groupBy({
      by: ['status'], where: { accountId }, _count: { status: true },
    });
    const statsMap: Record<string, number> = Object.fromEntries(
      Object.values(LeadStatus).map(s => [s, 0])
    );
    counts.forEach(r => { statsMap[r.status] = r._count.status; });
    const total     = Object.values(statsMap).reduce((a, b) => a + b, 0);
    const converted = (statsMap[LeadStatus.BOOKED] ?? 0) + (statsMap[LeadStatus.QUALIFIED] ?? 0);
    return { total, byStatus: statsMap, conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0 };
  }

  // ── Soft delete ───────────────────────────────────────────────────
  async remove(id: string, accountId: string) {
    await this.assertExists(id, accountId);
    return this.prisma.lead.update({ where: { id }, data: { status: LeadStatus.CLOSED } });
  }

  private async assertExists(id: string, accountId: string) {
    const l = await this.prisma.lead.findFirst({ where: { id, accountId } });
    if (!l) throw new NotFoundException(`Lead ${id} not found`);
    return l;
  }
}
