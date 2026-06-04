import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global request validation — every @Body() / @Query() / @Param() is validated
  // against its DTO (class-validator). Reject unknown properties, coerce types.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS — permissive defaults for dev; tighten via CORS_ORIGIN env in prod.
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : true;
  app.enableCors({ origin: corsOrigins, credentials: true });

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port);
  Logger.log(`api-gateway listening on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
