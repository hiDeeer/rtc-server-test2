import * as net from 'net';

export class TurnServer {
  private turnServer: net.Server;

  constructor() {
    this.turnServer = net.createServer((socket) => {
      console.log(`Client connected from ${socket.remoteAddress}:${socket.remotePort}`);
      socket.on('data', (data) => {
        console.log('Received data from client:', data.toString());
        socket.write('TURN relay: ' + data);
      });
      socket.on('end', () => {
        console.log('Client disconnected');
      });
    });

    this.turnServer.listen(3478, () => {
      console.log('TURN Server listening on port 3478');
    });
  }
}
