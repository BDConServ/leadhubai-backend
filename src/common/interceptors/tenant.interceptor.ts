// src/common/interceptors/tenant.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, ForbiddenException, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req  = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user?.accountId) return next.handle();

    const bodyAccountId = req.body?.accountId;
    if (bodyAccountId && bodyAccountId !== user.accountId) {
      this.logger.warn(`TENANT MISMATCH — token:${user.accountId} body:${bodyAccountId}`);
      throw new ForbiddenException('Tenant mismatch');
    }
    return next.handle();
  }
}
