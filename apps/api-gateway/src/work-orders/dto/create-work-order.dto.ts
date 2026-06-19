import type { WorkOrderPriority } from '@digital-twin-fm/types';

export interface CreateWorkOrderDto {
  assetId: string;
  alertId?: string;
  title: string;
  description?: string;
  priority?: WorkOrderPriority;
}
