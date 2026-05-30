export interface Item {
  id: string;
  name: string;
  code?: string;
  category?: string;
  latestDate?: string;
  latestPerson?: string;
  latestQuantity?: number;
  latestLocation?: string;
  latestUnit?: string;
  latestWarehouseQty?: number;
  latestDiffQty?: number;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
}

export interface InventoryRecord {
  id: string;
  itemId: string;
  itemName: string;
  inventoryDate: string;
  personName: string;
  quantity: number;
  location?: string;
  unit?: string;
  warehouseQty?: number;
  diffQty?: number;
  notes?: string;
  matchingNo?: string;
  detailLineNo?: string;
  itemNotes?: string;
  sheetNo?: string;
  dataEntryPerson?: string;
  sheetNotes?: string;
  generalManagerNotes?: string;
  isApproved?: string;
  additionalFields?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
}
