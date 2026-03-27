import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { OnboardingStatus } from '@prisma/client';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  // ── STEP 1: Register a new customer ──────────────────────────────────────────
  async registerCustomer(dto: CreateCustomerDto) {
    // Check if email already exists
    const existing = await this.prisma.customer.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException(
        `An account with email ${dto.email} already exists.`,
      );
    }

    // Create the customer + default settings in one transaction
    const customer = await this.prisma.customer.create({
      data: {
        businessName: dto.businessName,
        ownerName: dto.ownerName,
        email: dto.email,
        phone: dto.phone,
        website: dto.website,
        industry: dto.industry,
        plan: dto.plan ?? 'STARTER',
        onboardingStep: 1,
        // Auto-create default settings
        settings: {
          create: {
            aiResponseEnabled: true,
            responseDelaySeconds: 30,
            notifyEmail: true,
            notifyPhone: false,
          },
        },
      },
      include: { settings: true },
    });

    return {
      message: 'Customer registered successfully. Proceed to step 2.',
      customer,
    };
  }

  // ── STEP 2: Save AI & notification settings ───────────────────────────────────
  async updateSettings(customerId: string, dto: UpdateSettingsDto) {
    const customer = await this.findCustomerOrFail(customerId);

    const settings = await this.prisma.customerSettings.upsert({
      where: { customerId },
      update: { ...dto },
      create: {
        customerId,
        ...dto,
      },
    });

    // Advance the onboarding step if still on step 1
    if (customer.onboardingStep < 2) {
      await this.prisma.customer.update({
        where: { id: customerId },
        data: { onboardingStep: 2 },
      });
    }

    return {
      message: 'Settings saved. Proceed to step 3 (activate your account).',
      settings,
    };
  }

  // ── STEP 3: Activate the customer (complete onboarding) ───────────────────────
  async activateCustomer(customerId: string) {
    const customer = await this.findCustomerOrFail(customerId);

    if (customer.onboardingStep < 2) {
      throw new BadRequestException(
        'Please complete your settings (step 2) before activating.',
      );
    }

    if (customer.status === OnboardingStatus.ACTIVE) {
      return { message: 'Account is already active.', customer };
    }

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        status: OnboardingStatus.ACTIVE,
        onboardingStep: 3,
      },
      include: { settings: true },
    });

    return {
      message: '🎉 Onboarding complete! Your account is now active.',
      customer: updated,
    };
  }

  // ── GET: Retrieve a customer by ID ────────────────────────────────────────────
  async getCustomer(customerId: string) {
    return this.findCustomerOrFail(customerId);
  }

  // ── GET: List all customers (admin use) ───────────────────────────────────────
  async getAllCustomers() {
    return this.prisma.customer.findMany({
      include: { settings: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── HELPER: Find or throw 404 ─────────────────────────────────────────────────
  private async findCustomerOrFail(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { settings: true },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found.`);
    }

    return customer;
  }
}
