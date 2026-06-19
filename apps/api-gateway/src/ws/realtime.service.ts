import { Injectable } from '@nestjs/common';
import { RealtimeGateway, AssetUpdatePayload } from './realtime.gateway';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  broadcastAssetUpdate(payload: AssetUpdatePayload) {
    this.gateway.broadcastAssetUpdate(payload);
  }

  broadcastAlert(alert: any) {
    this.gateway.broadcastAlert(alert);
  }

  broadcastWorkOrderUpdate(workOrder: any) {
    this.gateway.broadcastWorkOrderUpdate(workOrder);
  }
}