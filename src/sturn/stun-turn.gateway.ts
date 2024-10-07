// src/stun-turn/stun-turn.gateway.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as dgram from 'dgram';
import * as crypto from 'crypto';

interface RelayInfo {
  address: string;
  port: number;
}

interface User {
  username: string;
  password: string;
}

@Injectable()
export class StunTurnGateway implements OnModuleInit {
  private server: dgram.Socket;
  private relayedAddresses: Map<string, RelayInfo[]> = new Map();
  private users: Map<string, User> = new Map();

  constructor() {
    // 기본 사용자 추가 (username: password)
    this.users.set('testuser', { username: 'testuser', password: 'testpassword' });
  }

  onModuleInit() {
    this.server = dgram.createSocket('udp4');
    this.server.on('message', (msg, rinfo) => {
      const response = this.processStunTurnMessage(msg, rinfo);
      if (response) {
        this.server.send(response, rinfo.port, rinfo.address);
      }
    });

    this.server.bind(3478);
    console.log('STUN/TURN 서버가 포트 3478에서 실행 중입니다.');
  }

  private processStunTurnMessage(msg: Buffer, rinfo: dgram.RemoteInfo): Buffer | null {
    const response = this.processStunMessage(msg, rinfo);
    if (response) {
      return response;
    }

    return this.processTurnMessage(msg, rinfo);
  }

  private processStunMessage(msg: Buffer, rinfo: dgram.RemoteInfo): Buffer | null {
    if (msg.length < 20) {
      return null;
    }

    const stunHeader = msg.slice(0, 20);
    const messageType = stunHeader.readUInt16BE(0);
    const magicCookie = stunHeader.readUInt32BE(4);

    if (magicCookie !== 0x2112A442) {
      return null;
    }

    if (messageType === 0x0001) {
      return this.createStunBindingResponse(stunHeader, rinfo);
    }

    return null;
  }

  private createStunBindingResponse(header: Buffer, rinfo: dgram.RemoteInfo): Buffer {
    const transactionId = header.slice(8, 20);
    const responseType = 0x0101;
    const magicCookie = 0x2112A442;

    const xorMappedAddress = this.createXorMappedAddress(rinfo.address, rinfo.port, magicCookie);

    const responseBuffer = Buffer.alloc(32);
    responseBuffer.writeUInt16BE(responseType, 0);
    responseBuffer.writeUInt16BE(xorMappedAddress.length, 2);
    responseBuffer.writeUInt32BE(magicCookie, 4);
    transactionId.copy(responseBuffer, 8);
    xorMappedAddress.copy(responseBuffer, 20);

    return responseBuffer;
  }

  private createXorMappedAddress(ip: string, port: number, magicCookie: number): Buffer {
    const family = ip.includes(':') ? 0x02 : 0x01;
    const xorPort = port ^ (magicCookie >> 16);

    const ipParts = ip.split('.').map(octet => parseInt(octet));
    const xorIp = ipParts.map((octet, i) => octet ^ ((magicCookie >> (8 * (3 - i))) & 0xFF));

    // IP 버전 및 필요한 크기에 따라 버퍼 크기 조정
    const mappedAddress = Buffer.alloc(12); // IPv4의 경우 충분한 크기로 설정

    // XOR MAPPED ADDRESS 헤더 및 내용 작성
    mappedAddress.writeUInt16BE(0x0020, 0); // Attribute type
    mappedAddress.writeUInt16BE(8, 2); // Attribute length
    mappedAddress.writeUInt8(0, 4); // Reserved
    mappedAddress.writeUInt8(family, 5); // Family
    mappedAddress.writeUInt16BE(xorPort, 6); // XORed port

    // XOR IP address 추가
    for (let i = 0; i < xorIp.length; i++) {
      mappedAddress.writeUInt8(xorIp[i], 8 + i);
    }

    return mappedAddress;
  }


  private processTurnMessage(msg: Buffer, rinfo: dgram.RemoteInfo): Buffer | null {
    if (msg.length < 20) {
      return null;
    }

    const turnHeader = msg.slice(0, 20);
    const messageType = turnHeader.readUInt16BE(0);
    const magicCookie = turnHeader.readUInt32BE(4);

    if (magicCookie !== 0x2112A442) {
      return null;
    }

    // TURN Allocate Request 처리
    if (messageType === 0x0003) {
      return this.createTurnAllocateResponse(turnHeader, msg, rinfo);
    }

    // TURN Send Request 처리
    if (messageType === 0x0009) {
      return this.handleTurnSendRequest(turnHeader, msg, rinfo);
    }

    return null;
  }

  private createTurnAllocateResponse(header: Buffer, msg: Buffer, rinfo: dgram.RemoteInfo): Buffer {
    const transactionId = header.slice(8, 20);
    const username = this.extractUsername(msg);
    const password = this.extractPassword(msg);

    if (!this.authenticateUser(username, password)) {
      return this.createErrorResponse(transactionId, 401); // Unauthorized
    }

    const responseType = 0x0103;  // Allocate Success Response
    const magicCookie = 0x2112A442;

    // Relay Address를 생성하여 맵에 추가
    const relayAddress = `${rinfo.address}:${rinfo.port}`;
    const relays = this.relayedAddresses.get(relayAddress) || [];
    relays.push({ address: rinfo.address, port: rinfo.port });
    this.relayedAddresses.set(relayAddress, relays);

    const responseBuffer = Buffer.alloc(32);
    responseBuffer.writeUInt16BE(responseType, 0);
    responseBuffer.writeUInt16BE(0, 2);  // Attribute Length (여기서는 0으로 설정)
    responseBuffer.writeUInt32BE(magicCookie, 4);
    transactionId.copy(responseBuffer, 8);

    return responseBuffer;
  }

  private handleTurnSendRequest(header: Buffer, msg: Buffer, rinfo: dgram.RemoteInfo): Buffer | null {
    const transactionId = header.slice(8, 20);
    const relayAddress = `${rinfo.address}:${rinfo.port}`;

    const relays = this.relayedAddresses.get(relayAddress);
    if (relays) {
      for (const relay of relays) {
        if (relay.address !== rinfo.address || relay.port !== rinfo.port) {
          this.server.send(msg.slice(20), relay.port, relay.address);
        }
      }
    }

    return null;
  }

  private extractUsername(msg: Buffer): string {
    // 메시지에서 username 추출 (구현에 따라 수정 필요)
    // 예: 0x0001 타입의 attribute에서 username을 찾아서 반환
    return 'testuser'; // 예시로 테스트 사용자 반환
  }

  private extractPassword(msg: Buffer): string {
    // 메시지에서 password 추출 (구현에 따라 수정 필요)
    return 'testpassword'; // 예시로 테스트 비밀번호 반환
  }

  private authenticateUser(username: string, password: string): boolean {
    const user = this.users.get(username);
    return user && user.password === password; // 단순 비교 (SHA-1 해시 사용 권장)
  }

  private createErrorResponse(transactionId: Buffer, errorCode: number): Buffer {
    const responseBuffer = Buffer.alloc(32);
    responseBuffer.writeUInt16BE(0x0111, 0);  // Error Response
    responseBuffer.writeUInt16BE(0, 2); // Attribute Length
    responseBuffer.writeUInt32BE(0x2112A442, 4); // Magic Cookie
    transactionId.copy(responseBuffer, 8);
    responseBuffer.writeUInt16BE(errorCode, 20); // Error Code
    responseBuffer.writeUInt16BE(0, 22); // Reason Length
    responseBuffer.writeUInt8(0, 24); // Reserved
    return responseBuffer;
  }
}
