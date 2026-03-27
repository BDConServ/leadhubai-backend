// src/modules/accounts/accounts.module.ts
import { Module }            from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService }   from './accounts.service';
import { TwilioService }     from '../messaging/twilio.service';

@Module({
  providers:   [AccountsService, TwilioService],
  controllers: [AccountsController],
  exports:     [AccountsService],
})
export class AccountsModule {}
