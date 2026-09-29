import type { CartLine } from "./types";

export function changeQuantity(cart: CartLine[], id: string, quantity: number) {
  const previous = cart.find((line) => line.id === id)?.quantity || 0;
  const next = Number.isFinite(quantity)
    ? Math.max(0, Math.min(30, Math.trunc(quantity)))
    : previous;
  const lines = cart.filter((line) => line.id !== id);
  if (next)
    lines.splice(
      Math.max(
        0,
        cart.findIndex((line) => line.id === id),
      ),
      0,
      { id, quantity: next },
    );
  return { lines, delta: next - previous };
}

// Clear only the submitted quantities. A new selection made while a request is
// in flight belongs to the customer's next order and must be preserved.
export function completeCart(cart: CartLine[], submitted: CartLine[]) {
  return cart
    .map((line) => ({
      ...line,
      quantity: Math.max(
        0,
        line.quantity -
          (submitted.find((item) => item.id === line.id)?.quantity || 0),
      ),
    }))
    .filter((line) => line.quantity > 0);
}
