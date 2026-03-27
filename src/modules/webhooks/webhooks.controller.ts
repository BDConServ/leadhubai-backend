// src/modules/webhooks/webhooks.controller.ts
import { Controller, Post, Get, Body, Query, Req, Res, Headers, HttpCode, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { MetaWebhookService }   from './meta-webhook.service';
import { TwilioWebhookService } from './twilio-webhook.service';
import { validateMetaSignature }   from './guards/meta-signature.guard';
import { validateTwilioSignature } from './guards/twilio-signature.guard';

export interface TwilioInboundPayload {
  MessageSid: string; From: string; To: string;
  Body: string; NumMedia: string; AccountSid: string;
}

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly meta:   MetaWebhookService,
    private readonly twilio: TwilioWebhookService,
  ) {}

  // ── Meta verification handshake (one-time setup) ──────────────────
  @Get('meta')
  verifyMeta(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      this.logger.log('Meta webhook verified');
      return res.status(200).send(challenge);
    }
    this.logger.warn('Meta verification failed');
    return res.status(403).send('Forbidden');
  }

  // ── Meta inbound — Lead Ads + Messenger/IG DMs ────────────────────
  @Post('meta')
  @HttpCode(200)
  async handleMeta(
    @Body() body: any,
    @Headers('x-hub-signature-256') signature: string,
    @Req() req: Request,
  ) {
    const rawBody = (req as any).rawBody as Buffer;
    if (!validateMetaSignature(rawBody, signature)) {
      this.logger.warn('Invalid Meta signature');
      return { status: 'ignored' };
    }
    await this.meta.processEvent(body);
    return { status: 'ok' };
  }

  // ── Twilio inbound SMS ─────────────────────────────────────────────
  @Post('twilio')
  @HttpCode(200)
  async handleTwilio(
    @Body() body: TwilioInboundPayload,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: Request,
  ) {
    const url = `${process.env.APP_URL}/webhooks/twilio`;
    if (!validateTwilioSignature(signature, url, body as any)) {
      this.logger.warn('Invalid Twilio signature');
      return '<Response/>';
    }
    await this.twilio.processInboundSms(body);
    return '<Response/>';
  }

  // ── Twilio delivery status callbacks ──────────────────────────────
  @Post('twilio/status')
  @HttpCode(200)
  handleTwilioStatus(@Body() body: any) {
    this.logger.debug(`SMS status: ${body.MessageSid} → ${body.MessageStatus}`);
    return '<Response/>';
  }
}
