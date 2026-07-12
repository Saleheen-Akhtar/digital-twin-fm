import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc } from 'drizzle-orm';
import { workOrders, maintenanceLogs } from '@digital-twin-fm/db';
import type { WorkOrder } from '@digital-twin-fm/types';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';

export interface ListWorkOrdersFilter {
  status?: WorkOrder['status'];
  priority?: WorkOrder['priority'];
  assetId?: string;
  limit?: number;
  q?: string;
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
    createdBy: r.createdBy ?? undefined,
    dueAt: r.dueAt ?? undefined,
    startedAt: r.startedAt ?? undefined,
    completedAt: r.completedAt ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
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

    if (filter.q) {
      const q = filter.q.toLowerCase();
      return rows.filter(r => r.title.toLowerCase().includes(q)).map(mapWorkOrder);
    }

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

    await this.logAction(rows[0].id, 'created', 'Work order created');

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
      await this.logAction(id, dto.status, `Status changed to ${dto.status}`);
    }

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.assignedTo !== undefined) {
      updateData.assignedTo = dto.assignedTo;
      if (!existing[0].assignedTo && dto.assignedTo) {
        await this.logAction(id, 'assigned', `Assigned to ${dto.assignedTo}`);
      }
    }

    const rows = await this.db
      .update(workOrders)
      .set(updateData)
      .where(eq(workOrders.id, id))
      .returning();

    return mapWorkOrder(rows[0]);
  }

  /**
   * Fetch maintenance log entries for a work order.
   */
  async getLogs(workOrderId: string) {
    return this.db
      .select()
      .from(maintenanceLogs)
      .where(eq(maintenanceLogs.workOrderId, workOrderId))
      .orderBy(desc(maintenanceLogs.createdAt))
      .limit(50);
  }

  private async logAction(workOrderId: string, action: string, notes?: string) {
    await this.db.insert(maintenanceLogs).values({
      workOrderId,
      action,
      notes: notes ?? null,
    }).onConflictDoNothing();
  }
}
