// src/modules/webhooks/guards/meta-signature.guard.ts
import * as crypto from 'crypto';

export function validateMetaSignature(rawBody: Buffer, signature: string): boolean {
  if (!signature || !rawBody) return false;
  const secret = process.env.META_APP_SECRET;
  if (!secret) { console.warn('META_APP_SECRET not set'); return true; }

  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch { return false; }
}
