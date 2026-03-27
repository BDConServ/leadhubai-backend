import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

// All routes here start with /onboarding
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  // ── HEALTH CHECK ──────────────────────────────────────────────────────────────
  // GET /onboarding/health
  @Get('health')
  health() {
    return { status: 'ok', service: 'LeadHub Onboarding API', timestamp: new Date() };
  }

  // ── STEP 1: Register ──────────────────────────────────────────────────────────
  // POST /onboarding/register
  // Body: { businessName, ownerName, email, phone?, website?, industry?, plan? }
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: CreateCustomerDto) {
    return this.onboardingService.registerCustomer(dto);
  }

  // ── STEP 2: Save Settings ─────────────────────────────────────────────────────
  // PATCH /onboarding/:customerId/settings
  // Body: { aiResponseEnabled?, responseDelaySeconds?, notifyEmail?, notifyPhone?, businessHours?, aiGreeting? }
  @Patch(':customerId/settings')
  updateSettings(
    @Param('customerId') customerId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.onboardingService.updateSettings(customerId, dto);
  }

  // ── STEP 3: Activate ──────────────────────────────────────────────────────────
  // POST /onboarding/:customerId/activate
  @Post(':customerId/activate')
  activate(@Param('customerId') customerId: string) {
    return this.onboardingService.activateCustomer(customerId);
  }

  // ── GET: One Customer ─────────────────────────────────────────────────────────
  // GET /onboarding/:customerId
  @Get(':customerId')
  getCustomer(@Param('customerId') customerId: string) {
    return this.onboardingService.getCustomer(customerId);
  }

  // ── GET: All Customers ────────────────────────────────────────────────────────
  // GET /onboarding
  @Get()
  getAllCustomers() {
    return this.onboardingService.getAllCustomers();
  }
}
