import type { PaymentStatus, RowChange, WorkbookData } from '../../domain/workbook';

export interface OrdersProps {
  data: WorkbookData;
  busy: boolean;
  saveError?: string;
  onCommit: (changes: RowChange[], editBase?: RowChange[]) => Promise<boolean>;
}

interface DraftLine {
  key: number;
  variantId: string;
  quantity: number;
}

export interface DraftForm {
  customerId: string;
  customer: string;
  contact: string;
  address: string;
  notes: string;
  paymentStatus: PaymentStatus;
  partialAmount?: number;
  discount: number | '';
  shippingCharge: number | '';
  shippingOptionId: string;
  lines: DraftLine[];
}
