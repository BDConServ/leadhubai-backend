// src/modules/auth/auth.service.ts
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

export interface JwtPayload {
  sub:       string;
  accountId: string;
  role:      string;
  email:     string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly jwt:     JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where:   { email },
      include: { account: { include: { phoneNumbers: true } } },
    });

    if (!user) throw new UnauthorizedException('Invalid email or password');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid)  throw new UnauthorizedException('Invalid email or password');

    if (!user.account.active) throw new UnauthorizedException('Account deactivated');

    const payload: JwtPayload = {
      sub:       user.id,
      accountId: user.accountId,
      role:      user.role,
      email:     user.email,
    };

    this.logger.log(`Login: ${user.email} (account: ${user.accountId})`);

    return {
      accessToken: this.jwt.sign(payload),
      account: {
        id:           user.account.id,
        name:         user.account.name,
        businessType: user.account.businessType,
        autoReply:    user.account.autoReply,
        aiEnabled:    user.account.aiEnabled,
        phoneNumber:  user.account.phoneNumbers[0]?.number ?? null,
      },
    };
  }

  async validateJwt(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where:  { id: payload.sub },
      select: { id: true, accountId: true, role: true, email: true },
    });
    if (!user) throw new UnauthorizedException('Token invalid');
    return { userId: user.id, accountId: user.accountId, role: user.role, email: user.email };
  }
}
