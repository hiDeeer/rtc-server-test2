// src/app.module.ts
import { Module } from '@nestjs/common';
import { SignalingGateway } from './signaling/signaling.gateway';
import { StunTurnGateway } from './sturn/stun-turn.gateway';

@Module({
  providers: [SignalingGateway, StunTurnGateway],
})
export class AppModule {}
