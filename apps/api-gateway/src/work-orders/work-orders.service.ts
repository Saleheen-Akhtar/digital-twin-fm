import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc } from 'drizzle-orm';
import { workOrders } from '@digital-twin-fm/db';
import type { WorkOrder, WorkOrderStatus, WorkOrderPriority } from '@digital-twin-fm/types';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';

export interface ListWorkOrdersFilter {
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  assetId?: string;
  limit?: number;
}

function mapWorkOrder(r: typeof workOrders.$inferSelect): WorkOrder {
  return {
    id: r.id,
    assetId: r.assetId,
    alertId: r.alertId ?? undefined,
    title: r.title,
    description: r.description ?? undefined,
    type: r.type,
    priority: r.priority,
    status: r.status,
    assignedTo: r.assignedTo ?? undefined,
    createdAt: r.createdAt,
    dueAt: r.dueAt ?? undefined,
    completedAt: r.completedAt ?? undefined,
  };
}

@Injectable()
export class WorkOrdersService {
  constructor(@Inject('DB') private readonly db: NodePgDatabase) {}

  async findAll(filter: ListWorkOrdersFilter = {}): Promise<WorkOrder[]> {
    const conditions = [];
    if (filter.status) conditions.push(eq(workOrders.status, filter.status));
    if (filter.priority) conditions.push(eq(workOrders.priority, filter.priority));
    if (filter.assetId) conditions.push(eq(workOrders.assetId, filter.assetId));
    const where = conditions.length === 0 ? undefined :
      conditions.length === 1 ? conditions[0] : and(...conditions);
    const rows = await this.db
      .select()
      .from(workOrders)
      .where(where)
      .orderBy(desc(workOrders.createdAt))
      .limit(filter.limit ?? 100);
    return rows.map(mapWorkOrder);
  }

  async findOne(id: string): Promise<WorkOrder | null> {
    const rows = await this.db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
    return rows[0] ? mapWorkOrder(rows[0]) : null;
  }

  async create(dto: CreateWorkOrderDto): Promise<WorkOrder> {
    const rows = await this.db
      .insert(workOrders)
      .values({
        assetId: dto.assetId,
        alertId: dto.alertId ?? null,
        title: dto.title,
        description: dto.description ?? null,
        priority: dto.priority ?? 'medium',
      })
      .returning();
    return mapWorkOrder(rows[0]);
  }

  async update(id: string, dto: UpdateWorkOrderDto): Promise<WorkOrder> {
    const existing = await this.db
      .select()
      .from(workOrders)
      .where(eq(workOrders.id, id))
      .limit(1);
    if (!existing.length) throw new NotFoundException(`Work order ${id} not found`);

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    if (dto.status !== undefined) {
      updateData.status = dto.status;
      if (dto.status === 'in_progress' || dto.status === 'assigned') {
        updateData.startedAt = existing[0].startedAt ?? now;
      }
      if (dto.status === 'completed') {
        updateData.completedAt = now;
      }
    }

    const rows = await this.db
      .update(workOrders)
      .set(updateData)
      .where(eq(workOrders.id, id))
      .returning();

    return mapWorkOrder(rows[0]);
  }
}
