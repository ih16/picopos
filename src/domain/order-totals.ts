import { addedCharges, savedCharges } from './charges.ts';

export function lineSubtotal(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

export function orderSubtotal(items: readonly { quantity: number; unitPrice: number }[]): number {
  return items.reduce((subtotal, item) => subtotal + lineSubtotal(item.quantity, item.unitPrice), 0);
}

export function orderTotal(
  subtotal: number,
  order: { discount: number; shippingCharge: number; charges?: string },
  charges = savedCharges(order.charges),
): number {
  return subtotal - order.discount + order.shippingCharge + addedCharges(charges);
}
