// src/modules/messaging/twilio.service.ts
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import twilio from 'twilio';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly client: twilio.Twilio;

  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }

  async sendSms(params: { to: string; from: string; body: string }): Promise<string> {
    this.logger.log(`SMS → ${params.to}: "${params.body.substring(0, 40)}..."`);
    try {
      const msg = await this.client.messages.create({
        to:             params.to,
        from:           params.from,
        body:           params.body,
        statusCallback: `${process.env.APP_URL}/webhooks/twilio/status`,
      });
      return msg.sid;
    } catch (err) {
      this.logger.error(`Twilio error: ${err.message}`);
      throw new InternalServerErrorException(`SMS failed: ${err.message}`);
    }
  }

  async provisionTollFreeNumber(): Promise<{ number: string; sid: string }> {
    this.logger.log('Provisioning toll-free number...');
    try {
      const available = await this.client.availablePhoneNumbers('US').tollFree.list({ limit: 1 });
      if (!available.length) throw new Error('No toll-free numbers available');
      const purchased = await this.client.incomingPhoneNumbers.create({
        phoneNumber: available[0].phoneNumber,
        smsUrl:      `${process.env.APP_URL}/webhooks/twilio`,
        smsMethod:   'POST',
      });
      this.logger.log(`Provisioned: ${purchased.phoneNumber}`);
      return { number: purchased.phoneNumber, sid: purchased.sid };
    } catch (err) {
      this.logger.error(`Provision failed: ${err.message}`);
      throw new InternalServerErrorException(`Could not provision number: ${err.message}`);
    }
  }

  async getMessageStatus(sid: string): Promise<string> {
    try {
      const msg = await this.client.messages(sid).fetch();
      return msg.status;
    } catch { return 'unknown'; }
  }

  async releaseNumber(sid: string): Promise<void> {
    try {
      await this.client.incomingPhoneNumbers(sid).remove();
    } catch (err) {
      this.logger.error(`Release failed: ${err.message}`);
    }
  }
}
