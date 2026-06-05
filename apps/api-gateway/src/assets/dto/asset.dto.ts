export interface AssetDto {
  id: string;
  buildingId: string;
  floorId: string | null;
  roomId: string | null;
  name: string;
  type: string; // ahu | chiller | boiler | pump | fan | elevator | lighting | sensor_only | other
  status: string; // ok | warning | critical | offline | info
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  installedAt: string | null;
  positionX: number | null;
  positionY: number | null;
  positionZ: number | null;
  createdAt: string;
  updatedAt: string;
}
