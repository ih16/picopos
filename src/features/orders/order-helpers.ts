import type { OrderItem, Return as ReturnEntry, WorkbookData } from '../../domain/workbook';
import type { DraftForm } from './order-types';

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

export function indexOrderRows(data: WorkbookData) {
  const itemsByOrder = new Map<string, OrderItem[]>();
  const orderByItemId = new Map<string, string>();
  for (const item of data['Order Items']) {
    orderByItemId.set(item.id, item.orderId);
    const previous = itemsByOrder.get(item.orderId) ?? [];
    previous.push(item);
    itemsByOrder.set(item.orderId, previous);
  }
  const returnsByOrder = new Map<string, ReturnEntry[]>();
  for (const entry of data.Returns) {
    const orderId = orderByItemId.get(entry.orderItemId);
    if (!orderId) continue;
    const previous = returnsByOrder.get(orderId) ?? [];
    previous.push(entry);
    returnsByOrder.set(orderId, previous);
  }
  return { itemsByOrder, returnsByOrder };
}
