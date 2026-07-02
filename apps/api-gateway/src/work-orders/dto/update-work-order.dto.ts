import { IsOptional, IsString, IsIn } from 'class-validator';
import type { WorkOrderStatus, WorkOrderPriority } from '@digital-twin-fm/types';

export class UpdateWorkOrderDto {
  @IsOptional()
  @IsString()
  @IsIn(['open', 'assigned', 'in_progress', 'blocked', 'completed', 'cancelled'])
  status?: WorkOrderStatus;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(['low', 'medium', 'high', 'critical'])
  priority?: WorkOrderPriority;
}
