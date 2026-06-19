import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Injectable, Logger } from '@nestjs/common';

export interface AssetUpdatePayload {
  assetId: string;
  status: 'operational' | 'warning' | 'fault';
  metrics?: Record<string, number>;
}

export interface SensorReadingPayload {
  sensorId: string;
  assetId: string;
  value: number;
  unit: string;
  timestamp: string;
}

export interface SubscribePayload {
  floor?: number | 'all';
  type?: string | 'all';
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  namespace: '/realtime',
})
@Injectable()
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly clientRooms = new Map<string, Set<string>>();

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.data.user = payload;

      // Auto-join 'all' room for global updates
      await client.join('all');
      this.addClientToRoom(client.id, 'all');

      this.logger.log(`Client ${client.id} (user: ${payload.sub}) connected`);
    } catch (err: unknown) {
      this.logger.warn(`Client ${client.id} auth failed: ${(err as Error).message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const rooms = this.clientRooms.get(client.id);
    if (rooms) {
      for (const room of rooms) {
        client.leave(room);
      }
      this.clientRooms.delete(client.id);
    }
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribePayload,
  ) {
    const user = client.data.user;
    if (!user) return { success: false, error: 'Not authenticated' };

    // Leave previous floor/type rooms
    const currentRooms = this.clientRooms.get(client.id) || new Set();
    for (const room of currentRooms) {
      if (room.startsWith('floor:') || room.startsWith('type:')) {
        await client.leave(room);
        currentRooms.delete(room);
      }
    }

    // Join new rooms
    if (payload.floor !== undefined && payload.floor !== 'all') {
      const room = `floor:${payload.floor}`;
      await client.join(room);
      currentRooms.add(room);
    }

    if (payload.type !== undefined && payload.type !== 'all') {
      const room = `type:${payload.type}`;
      await client.join(room);
      currentRooms.add(room);
    }

    this.clientRooms.set(client.id, currentRooms);

    return { success: true, rooms: Array.from(currentRooms) };
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribePayload,
  ) {
    const currentRooms = this.clientRooms.get(client.id) || new Set();

    if (payload.floor !== undefined && payload.floor !== 'all') {
      const room = `floor:${payload.floor}`;
      await client.leave(room);
      currentRooms.delete(room);
    }

    if (payload.type !== undefined && payload.type !== 'all') {
      const room = `type:${payload.type}`;
      await client.leave(room);
      currentRooms.delete(room);
    }

    this.clientRooms.set(client.id, currentRooms);

    return { success: true, rooms: Array.from(currentRooms) };
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { success: true, pong: Date.now() };
  }

  /** Broadcast asset status update to relevant rooms */
  broadcastAssetUpdate(payload: AssetUpdatePayload) {
    // Emit to 'all' room
    this.server.to('all').emit('asset:updated', payload);

    // Could also emit to floor/type rooms if we had that info
    // For now, frontend subscribes to 'all' and filters client-side
  }

  /** Broadcast new alert */
  broadcastAlert(alert: any) {
    this.server.to('all').emit('alert:created', alert);
  }

  /** Broadcast work order update */
  broadcastWorkOrderUpdate(workOrder: any) {
    this.server.to('all').emit('workOrder:updated', workOrder);
  }

  /** Broadcast live sensor reading to all connected clients */
  broadcastSensorReading(payload: SensorReadingPayload) {
    this.server.to('all').emit('sensor:reading', payload);
  }

  private extractToken(client: Socket): string | null {
    // Check Socket.IO auth handshake (sent by client `auth: { token }`)
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string') {
      return authToken;
    }

    // Check auth header (Bearer token)
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // Check query param (for URL-based fallback)
    const queryToken = client.handshake.query.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }

  private addClientToRoom(clientId: string, room: string) {
    const rooms = this.clientRooms.get(clientId) || new Set();
    rooms.add(room);
    this.clientRooms.set(clientId, rooms);
  }
}