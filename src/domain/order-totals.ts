export function lineSubtotal(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

export function orderSubtotal(items: readonly { quantity: number; unitPrice: number }[]): number {
  return items.reduce((subtotal, item) => subtotal + lineSubtotal(item.quantity, item.unitPrice), 0);
}

export function orderTotal(
  subtotal: number,
  { discount, shippingCharge }: { discount: number; shippingCharge: number },
): number {
  return subtotal - discount + shippingCharge;
}
