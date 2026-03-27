// src/modules/accounts/accounts.service.ts
import { Injectable, Logger, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService }  from '../../prisma/prisma.service';
import { TwilioService }  from '../messaging/twilio.service';
import * as bcrypt from 'bcrypt';
import { CreateAccountDto, UpdateAccountDto, ToggleAutoReplyDto, ToggleAiDto, ConnectMetaPageDto } from './accounts.dto';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly twilio:  TwilioService,
  ) {}

  // ── Create account + provision number ────────────────────────────
  async create(dto: CreateAccountDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const { account, user } = await this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: { name: dto.name, businessType: dto.businessType, metaPageId: dto.metaPageId },
      });
      const user = await tx.user.create({
        data: { email: dto.email, passwordHash, accountId: account.id, role: 'OWNER' },
      });
      return { account, user };
    });

    this.logger.log(`Account created: ${account.id} (${account.name})`);

    let phoneNumber: string | null = null;
    try {
      const provisioned = await this.twilio.provisionTollFreeNumber();
      await this.prisma.phoneNumber.create({
        data: { number: provisioned.number, sid: provisioned.sid, accountId: account.id },
      });
      phoneNumber = provisioned.number;
    } catch (err) {
      this.logger.error(`Number provisioning failed: ${err.message}`);
    }

    return { accountId: account.id, name: account.name, businessType: account.businessType, phoneNumber, numberProvisioned: !!phoneNumber };
  }

  // ── Get account ───────────────────────────────────────────────────
  async findOne(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where:   { id: accountId },
      include: { phoneNumbers: true, _count: { select: { leads: true } } },
    });
    if (!account) throw new NotFoundException('Account not found');
    return {
      id:           account.id,
      name:         account.name,
      businessType: account.businessType,
      autoReply:    account.autoReply,
      aiEnabled:    account.aiEnabled,
      metaPageId:   account.metaPageId,
      phoneNumbers: account.phoneNumbers.map(p => ({ number: p.number, active: p.active })),
      totalLeads:   account._count.leads,
      createdAt:    account.createdAt,
    };
  }

  // ── Stats ─────────────────────────────────────────────────────────
  async getStats(accountId: string) {
    await this.assertExists(accountId);
    const [leadStats, messageCount, followUpCount] = await Promise.all([
      this.prisma.lead.groupBy({ by: ['status'], where: { accountId }, _count: { status: true } }),
      this.prisma.message.count({ where: { lead: { accountId }, sentAt: { gte: new Date(Date.now() - 30*24*60*60*1000) } } }),
      this.prisma.followUp.count({ where: { lead: { accountId }, status: 'PENDING' } }),
    ]);

    const byStatus = Object.fromEntries(leadStats.map(r => [r.status, r._count.status]));
    const total    = Object.values(byStatus).reduce((a: number, b) => a + (b as number), 0) as number;
    const converted = ((byStatus['BOOKED'] ?? 0) as number) + ((byStatus['QUALIFIED'] ?? 0) as number);

    return {
      leads: { total, byStatus, conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0 },
      messages:  { last30Days: messageCount },
      followUps: { pending:    followUpCount },
    };
  }

  // ── Update ────────────────────────────────────────────────────────
  async update(accountId: string, dto: UpdateAccountDto) {
    await this.assertExists(accountId);
    return this.prisma.account.update({
      where: { id: accountId },
      data: {
        ...(dto.name         && { name: dto.name }),
        ...(dto.businessType && { businessType: dto.businessType }),
        ...(dto.autoReply    !== undefined && { autoReply: dto.autoReply }),
        ...(dto.metaPageId   !== undefined && { metaPageId: dto.metaPageId }),
      },
    });
  }

  // ── Toggle auto-reply ─────────────────────────────────────────────
  async toggleAutoReply(accountId: string, dto: ToggleAutoReplyDto) {
    await this.assertExists(accountId);
    const account = await this.prisma.account.update({
      where:  { id: accountId },
      data:   { autoReply: dto.enabled },
      select: { id: true, autoReply: true },
    });
    this.logger.log(`Account ${accountId} auto-reply → ${dto.enabled}`);
    return { accountId, autoReply: account.autoReply };
  }

  // ── Toggle AI (Premium feature gate) ─────────────────────────────
  async toggleAi(accountId: string, dto: ToggleAiDto) {
    await this.assertExists(accountId);
    const account = await this.prisma.account.update({
      where:  { id: accountId },
      data:   { aiEnabled: dto.enabled },
      select: { id: true, aiEnabled: true },
    });
    this.logger.log(`Account ${accountId} aiEnabled → ${dto.enabled}`);
    return { accountId, aiEnabled: account.aiEnabled };
  }

  // ── Connect Meta ──────────────────────────────────────────────────
  async connectMetaPage(accountId: string, dto: ConnectMetaPageDto) {
    await this.assertExists(accountId);
    const conflict = await this.prisma.account.findFirst({
      where: { metaPageId: dto.pageId, id: { not: accountId } },
    });
    if (conflict) throw new ConflictException('Facebook page already connected to another account');
    await this.prisma.account.update({
      where: { id: accountId },
      data:  { metaPageId: dto.pageId, metaAccessToken: dto.accessToken },
    });
    return { accountId, metaPageId: dto.pageId, connected: true };
  }

  // ── Provision number (retry) ──────────────────────────────────────
  async provisionNumber(accountId: string) {
    await this.assertExists(accountId);
    const existing = await this.prisma.phoneNumber.findFirst({ where: { accountId, active: true } });
    if (existing) throw new BadRequestException(`Already has number: ${existing.number}`);
    const provisioned = await this.twilio.provisionTollFreeNumber();
    const phone = await this.prisma.phoneNumber.create({
      data: { number: provisioned.number, sid: provisioned.sid, accountId },
    });
    return { number: phone.number, provisioned: true };
  }

  // ── Deactivate ────────────────────────────────────────────────────
  async deactivate(accountId: string) {
    await this.assertExists(accountId);
    await this.prisma.$transaction(async (tx) => {
      await tx.followUp.updateMany({ where: { lead: { accountId }, status: 'PENDING' }, data: { status: 'CANCELLED' } });
      await tx.phoneNumber.updateMany({ where: { accountId }, data: { active: false } });
      await tx.account.update({ where: { id: accountId }, data: { active: false } });
    });
    const numbers = await this.prisma.phoneNumber.findMany({ where: { accountId } });
    for (const n of numbers) {
      if (n.sid) await this.twilio.releaseNumber(n.sid).catch(e => this.logger.error(e.message));
    }
    return { accountId, deactivated: true };
  }

  private async assertExists(accountId: string) {
    const a = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!a) throw new NotFoundException('Account not found');
    return a;
  }
}
