// src/modules/accounts/accounts.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, UseGuards, HttpCode } from '@nestjs/common';
import { AccountsService }     from './accounts.service';
import { CreateAccountDto, UpdateAccountDto, ToggleAutoReplyDto, ToggleAiDto, ConnectMetaPageDto } from './accounts.dto';
import { JwtAuthGuard }        from '../../common/guards/jwt-auth.guard';
import { CurrentAccount }      from '../../common/decorators/current-account.decorator';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  // Public — signup
  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.accountsService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  findOne(@CurrentAccount() accountId: string) {
    return this.accountsService.findOne(accountId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/stats')
  getStats(@CurrentAccount() accountId: string) {
    return this.accountsService.getStats(accountId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  update(@CurrentAccount() accountId: string, @Body() dto: UpdateAccountDto) {
    return this.accountsService.update(accountId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/auto-reply')
  @HttpCode(200)
  toggleAutoReply(@CurrentAccount() accountId: string, @Body() dto: ToggleAutoReplyDto) {
    return this.accountsService.toggleAutoReply(accountId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/ai')
  @HttpCode(200)
  toggleAi(@CurrentAccount() accountId: string, @Body() dto: ToggleAiDto) {
    return this.accountsService.toggleAi(accountId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/meta')
  @HttpCode(200)
  connectMeta(@CurrentAccount() accountId: string, @Body() dto: ConnectMetaPageDto) {
    return this.accountsService.connectMetaPage(accountId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/provision-number')
  @HttpCode(200)
  provisionNumber(@CurrentAccount() accountId: string) {
    return this.accountsService.provisionNumber(accountId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  @HttpCode(200)
  deactivate(@CurrentAccount() accountId: string) {
    return this.accountsService.deactivate(accountId);
  }
}
