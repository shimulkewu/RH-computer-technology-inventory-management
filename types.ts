/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  barcode: string;
  description: string;
  category: string;
  costPrice: number;
  salePrice: number;
  quantity: number;
  minStockThreshold: number;
  maxStockThreshold?: number;
  reorderQuantity?: number;
  storageLocation?: string;
  supplierName?: string;
  updatedAt: string;
  updatedBy: string;
  imageUrl?: string;
}

export type LogType = 'STOCK_IN' | 'STOCK_OUT' | 'SALE' | 'ADJUSTMENT' | 'CREATE' | 'DELETE';

export interface AuditLog {
  id: string;
  productId: string;
  productName: string;
  type: LogType;
  delta: number;
  quantityAfter: number;
  employeeName: string;
  timestamp: string;
  notes: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  barcode: string;
  quantity: number;
  salePrice: number;
  costPrice: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  totalAmount: number;
  profit: number;
  employeeName: string;
  timestamp: string;
}

export interface BackupData {
  products: Product[];
  auditLogs: AuditLog[];
  sales: Sale[];
  exportedAt: string;
  businessName: string;
}

export interface SyncConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
}
