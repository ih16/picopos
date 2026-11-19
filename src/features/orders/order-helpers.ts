import type { DraftForm } from './order-types';
import type { OrderItem, Return as ReturnEntry } from '../../domain/workbook';

export function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

export function quantityLabel(quantity: number) {
  return `${quantity} ${quantity === 1 ? 'unit' : 'units'}`;
}

export function emptyDraft(): DraftForm {
  return {
    customerId: '',
    customer: '',
    contact: '',
    address: '',
    notes: '',
    paymentStatus: 'Unpaid',
    discount: '',
    shippingCharge: '',
    shippingOptionId: '',
    lines: [{ key: 0, variantId: '', quantity: 1 }],
  };
}

export function countRemaining(item: OrderItem, returns: ReturnEntry[]) {
  const returned = returns.reduce(
    (sum, entry) => sum + (entry.orderItemId === item.id ? entry.quantity : 0),
    0,
  );
  return item.quantity - returned;
}

export function returnLabel(items: OrderItem[], returns: ReturnEntry[]) {
  const received = returns.reduce(
    (sum, entry) => sum + (entry.status === 'Received' ? entry.quantity : 0),
    0,
  );
  if (received > 0) {
    const ordered = items.reduce((sum, item) => sum + item.quantity, 0);
    return received >= ordered ? 'Returned' : 'Partially returned';
  }
  return returns.some((entry) => entry.status === 'Requested') ? 'Return requested' : '';
}
