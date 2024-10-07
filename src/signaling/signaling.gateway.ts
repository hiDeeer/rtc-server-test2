// src/signaling/signaling.gateway.ts
import { WebSocketGateway, SubscribeMessage, MessageBody, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface Room {
  id: string;
  clients: string[];
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class SignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private rooms: Map<string, Room> = new Map();  // 방 목록

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.leaveRoom(client);
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(client: Socket, roomId: string) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, { id: roomId, clients: [] });
    }

    const room = this.rooms.get(roomId);
    room.clients.push(client.id);
    client.join(roomId);  // Socket.IO의 방 기능 사용
    console.log(`Client ${client.id} joined room ${roomId}`);

    // 같은 방에 있는 다른 클라이언트에게 알림
    client.to(roomId).emit('new-peer', client.id);
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(client: Socket, roomId: string) {
    client.leave(roomId);
    this.leaveRoom(client, roomId);
  }

  private leaveRoom(client: Socket, roomId?: string) {
    const roomsToCheck = roomId ? [roomId] : [...this.rooms.keys()];

    roomsToCheck.forEach((roomId) => {
      const room = this.rooms.get(roomId);
      if (room) {
        room.clients = room.clients.filter((id) => id !== client.id);
        client.to(roomId).emit('peer-disconnected', client.id);

        if (room.clients.length === 0) {
          this.rooms.delete(roomId);  // 방에 클라이언트가 없으면 삭제
        }
      }
    });
  }

  @SubscribeMessage('offer')
  handleOffer(client: Socket, payload: { offer: any, roomId: string }) {
    console.log(`Received offer from ${client.id} for room ${payload.roomId}`);
    client.to(payload.roomId).emit('offer', { offer: payload.offer, sender: client.id });
    console.log(`Emitted offer to room ${payload.roomId}`);
  }

  @SubscribeMessage('answer')
  handleAnswer(client: Socket, payload: { answer: any, roomId: string }) {
    console.log(`Received answer from ${client.id} for room ${payload.roomId}`);
    client.to(payload.roomId).emit('answer', { answer: payload.answer, sender: client.id });
    console.log(`Emitted answer to room ${payload.roomId}`);
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(client: Socket, payload: { candidate: any, roomId: string }) {
    console.log(`Received ICE candidate from ${client.id} for room ${payload.roomId}`);
    client.to(payload.roomId).emit('ice-candidate', { candidate: payload.candidate, sender: client.id });
    console.log(`Emitted ICE candidate to room ${payload.roomId}`);
  }

}
