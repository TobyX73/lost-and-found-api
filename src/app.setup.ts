import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Env } from './config/env.schema.js';

/** Shared by main.ts and the e2e tests so both run the same app. */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableCors({ origin: config.get('CORS_ORIGIN', { infer: true }).split(',') });
  app.enableShutdownHooks();

  // Swagger endpoints are not covered by guards, so keep them out of production.
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const document = new DocumentBuilder()
      .setTitle('Lost & Found API')
      .setDescription('Publicar objetos perdidos/encontrados y conectar a sus dueños.')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, document));
  }
}
