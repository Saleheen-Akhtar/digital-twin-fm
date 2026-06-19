import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc } from 'drizzle-orm';
import { alerts } from '@digital-twin-fm/db';
import type { Alert, AlertStatus, AlertSeverity } from '@digital-twin-fm/types';
import { UpdateAlertDto } from './dto/update-alert.dto';

export interface ListAlertsFilter {
  status?: AlertStatus;
  severity?: AlertSeverity;
  assetId?: string;
  limit?: number;
}

@Injectable()
export class AlertsService {
  constructor(@Inject('DB') private readonly db: NodePgDatabase) {}

  async findAll(filter: ListAlertsFilter = {}): Promise<Alert[]> {
    const conditions = [];
    if (filter.status) conditions.push(eq(alerts.status, filter.status));
    if (filter.severity) conditions.push(eq(alerts.severity, filter.severity));
    if (filter.assetId) conditions.push(eq(alerts.assetId, filter.assetId));
    const where = conditions.length === 0 ? undefined :
      conditions.length === 1 ? conditions[0] : and(...conditions);
    return this.db
      .select()
      .from(alerts)
      .where(where)
      .orderBy(desc(alerts.createdAt))
      .limit(filter.limit ?? 100);
  }

  async findOne(id: string): Promise<Alert | null> {
    const rows = await this.db.select().from(alerts).where(eq(alerts.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async update(id: string, dto: UpdateAlertDto): Promise<Alert> {
    const existing = await this.findOne(id);
    if (!existing) throw new NotFoundException(`Alert ${id} not found`);

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {};

    if (dto.status !== undefined) {
      updateData.status = dto.status;
      if (dto.status === 'acknowledged') {
        updateData.acknowledgedAt = now;
      }
      if (dto.status === 'resolved') {
        updateData.resolvedAt = now;
      }
    }

    const rows = await this.db
      .update(alerts)
      .set(updateData)
      .where(eq(alerts.id, id))
      .returning();

    return rows[0];
  }
}
