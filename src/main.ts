// src/main.ts
import { NestFactory }    from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as express       from 'express';
import { AppModule }      from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app    = await NestFactory.create(AppModule, { bodyParser: false });

  // ── CORS ─────────────────────────────────────────────────────────
  // Allow all LeadHub AI domains + local dev
  app.enableCors({
    origin: [
      'http://localhost:5173',            // Vite local dev
      'https://leadhubai.io',            // marketing site
      'https://www.leadhubai.io',        // www redirect
      'https://app.leadhubai.io',        // React app (Vercel)
      process.env.FRONTEND_URL,          // fallback env var
    ].filter(Boolean) as string[],
    credentials:    true,
    methods:        ['GET','POST','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
  });

  // ── Raw body — required for Meta + Twilio webhook signatures ─────
  app.use(
    express.json({
      verify: (req: any, _res, buf) => { req.rawBody = buf; },
    }),
  );
  app.use(express.urlencoded({ extended: true }));

  // ── Global validation ─────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,
      forbidNonWhitelisted: true,
      transform:            true,
    }),
  );

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(`⚡ LeadHub AI API running on port ${port}`);
  logger.log(`🌍 Environment:  ${process.env.NODE_ENV}`);
  logger.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL ?? 'http://localhost:5173'}`);
  logger.log(`🚀 App URL:      ${process.env.APP_URL      ?? 'http://localhost:3000'}`);
}

bootstrap();
