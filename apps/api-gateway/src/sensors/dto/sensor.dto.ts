export interface SensorDto {
  id: string;
  assetId: string;
  type: string; // temperature | humidity | power | vibration | co2 | occupancy | pressure | flow
  unit: string;
  status: string;
  thresholdLow: number | null;
  thresholdHigh: number | null;
  lastValue: number | null;
  lastReadingAt: string | null;
  createdAt: string;
}

export interface SensorReadingDto {
  id: string;
  sensorId: string;
  assetId: string;
  timestamp: string;
  value: number;
  quality: string; // good | uncertain | bad
}
