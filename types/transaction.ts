export type TransactionType = 'entrada' | 'salida';

export interface Transaction {
  id: string;
  type: TransactionType;
  productType?: string;
  productName: string;
  quantity: number;
  unitPrice?: number;
  totalValue: number;
  date: string;
  notes?: string;
  exchangeRate?: number; // USD to ARS rate at transaction time
}

export interface MonthlySummary {
  month: string;
  year: number;
  totalEntradas: number;
  totalSalidas: number;
  margenBruto: number;
  transactionCount: number;
}
