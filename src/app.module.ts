import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { OnboardingModule } from './onboarding/onboarding.module';

@Module({
  imports: [
    // Load .env variables globally
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    OnboardingModule,
  ],
})
export class AppModule {}
