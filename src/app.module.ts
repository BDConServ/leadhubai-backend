// src/app.module.ts
import { Module }          from '@nestjs/common';
import { ConfigModule }    from '@nestjs/config';
import { BullModule }      from '@nestjs/bullmq';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { PrismaModule }    from './prisma/prisma.module';
import { AuthModule }      from './modules/auth/auth.module';
import { AccountsModule }  from './modules/accounts/accounts.module';
import { LeadsModule }     from './modules/leads/leads.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { WebhooksModule }  from './modules/webhooks/webhooks.module';
import { FollowUpsModule } from './modules/follow-ups/follow-ups.module';
import { AiModule }        from './modules/ai/ai.module';
import { AppController }   from './app.controller';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';

@Module({
  imports: [
    // Global config — loads .env into process.env
    ConfigModule.forRoot({ isGlobal: true }),

    // BullMQ Redis connection — registered once, used by all queue modules
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      },
    }),

    PrismaModule,    // @Global — available everywhere without importing
    AuthModule,
    AccountsModule,
    LeadsModule,
    MessagingModule,
    WebhooksModule,
    FollowUpsModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [
    // Tenant isolation on every authenticated request
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
})
export class AppModule {}
