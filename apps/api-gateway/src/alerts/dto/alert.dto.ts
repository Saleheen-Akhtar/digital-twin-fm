export interface AlertDto {
  id: string;
  sensorId: string | null;
  assetId: string | null;
  severity: string; // low | medium | high | critical
  status: string; // open | acknowledged | in_progress | resolved | cancelled
  message: string;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}
