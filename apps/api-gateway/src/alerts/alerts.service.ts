import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc } from 'drizzle-orm';
import { alerts } from '@digital-twin-fm/db';
import { AlertDto } from './dto/alert.dto';

export interface ListAlertsFilter {
  status?: string;
  severity?: string;
  assetId?: string;
  limit?: number;
}

@Injectable()
export class AlertsService {
  constructor(@Inject('DB') private readonly db: NodePgDatabase) {}

  async findAll(filter: ListAlertsFilter = {}): Promise<AlertDto[]> {
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

  async findOne(id: string): Promise<AlertDto | null> {
    const rows = await this.db.select().from(alerts).where(eq(alerts.id, id)).limit(1);
    return rows[0] ?? null;
  }
}
