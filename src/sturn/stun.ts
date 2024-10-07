import * as dgram from 'dgram';

export class StunServer {
  private stunServer: dgram.Socket;

  constructor() {
    this.stunServer = dgram.createSocket('udp4');
    this.stunServer.on('message', (msg, rinfo) => {
      console.log(`STUN request from ${rinfo.address}:${rinfo.port}`);
      const stunResponse = Buffer.from([0x01, 0x01, 0x00, 0x00]);
      this.stunServer.send(stunResponse, rinfo.port, rinfo.address);
    });

    this.stunServer.bind(3478, () => {
      console.log('STUN Server listening on port 3478');
    });
  }
}
