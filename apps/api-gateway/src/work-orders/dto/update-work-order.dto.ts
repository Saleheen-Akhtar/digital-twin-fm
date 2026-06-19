import type { WorkOrderStatus } from '@digital-twin-fm/types';

export interface UpdateWorkOrderDto {
  status?: WorkOrderStatus;
}
