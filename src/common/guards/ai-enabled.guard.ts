// src/common/guards/ai-enabled.guard.ts
// Blocks all /ai/* routes if account.aiEnabled = false.
// Returns 403 with an upgrade message instead of 401 so the
// frontend can show the correct "upgrade your plan" UI.

import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AiEnabledGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req       = context.switchToHttp().getRequest();
    const accountId = req.user?.accountId;

    if (!accountId) return false;

    const account = await this.prisma.account.findUnique({
      where:  { id: accountId },
      select: { aiEnabled: true },
    });

    if (!account?.aiEnabled) {
      throw new ForbiddenException(
        'AI features require a Growth or Pro plan. Upgrade at https://leadhubai.io/#pricing',
      );
    }

    return true;
  }
}
