// src/modules/webhooks/guards/twilio-signature.guard.ts
import * as crypto from 'crypto';

export function validateTwilioSignature(
  signature: string, url: string, params: Record<string, string>,
): boolean {
  if (!signature) return false;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) { console.warn('TWILIO_AUTH_TOKEN not set'); return true; }

  const paramString = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], '');
  const expected    = crypto.createHmac('sha1', authToken).update(url + paramString).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch { return false; }
}
