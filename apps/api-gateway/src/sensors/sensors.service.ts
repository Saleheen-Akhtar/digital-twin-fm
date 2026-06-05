import { Inject, Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { sensors, sensorReadings } from '@digital-twin-fm/db';
import { SensorDto, SensorReadingDto } from './dto/sensor.dto';

export interface ListReadingsFilter {
  sensorId: string;
  from?: string; // ISO timestamp
  to?: string;
  limit?: number;
}

@Injectable()
export class SensorsService {
  constructor(@Inject('DB') private readonly db: NodePgDatabase) {}

  async findAll(): Promise<SensorDto[]> {
    return this.db.select().from(sensors);
  }

  async findOne(id: string): Promise<SensorDto | null> {
    const rows = await this.db.select().from(sensors).where(eq(sensors.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findReadings(filter: ListReadingsFilter): Promise<SensorReadingDto[]> {
    const conditions = [eq(sensorReadings.sensorId, filter.sensorId)];
    if (filter.from) conditions.push(gte(sensorReadings.timestamp, filter.from));
    if (filter.to) conditions.push(lte(sensorReadings.timestamp, filter.to));
    const rows = await this.db
      .select()
      .from(sensorReadings)
      .where(and(...conditions))
      .orderBy(desc(sensorReadings.timestamp))
      .limit(filter.limit ?? 100);
    return rows as SensorReadingDto[];
  }
}
