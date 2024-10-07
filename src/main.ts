// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SignalingGateway } from './signaling/signaling.gateway';
import { StunTurnGateway } from './sturn/stun-turn.gateway';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const sslOptions = {
    key: fs.readFileSync(path.join('/etc/letsencrypt/live/hideeer.p-e.kr', 'privkey.pem')),
    cert: fs.readFileSync(path.join('/etc/letsencrypt/live/hideeer.p-e.kr', 'fullchain.pem')),
  };

  const app = await NestFactory.create(AppModule, {
    httpsOptions: sslOptions,
  });

  app.enableCors();

  const signalingGateway = app.get(SignalingGateway);
  const stunTurnGateway = app.get(StunTurnGateway);

  await app.listen(443);
  console.log('WebRTC 서버가 https://hideeer.p-e.kr 에서 실행 중입니다.');
}

bootstrap();
