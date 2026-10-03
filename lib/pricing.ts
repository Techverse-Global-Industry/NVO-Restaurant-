import { entry, settings, db } from "./db";
import { isLive, visiblePrice } from "./catalog";
import type { CartLine, Entry, Reward } from "./types";
export async function quote(lines: CartLine[], coupon = "", customerId = "") {
  const s = await settings();
  const seen = new Set<string>();
  const items = await Promise.all(lines.map(async (line) => {
    if (seen.has(line.id)) throw new Error("Duplicate meal in order.");
    seen.add(line.id);
    const meal = await entry(line.id);
    if (
      !meal ||
      meal.kind !== "meals" ||
      !isLive(meal) ||
      meal.available === false
    )
      throw new Error(
        "A selected meal is no longer available. Please refresh your menu.",
      );
    const category = meal.category ? await entry(meal.category) : undefined;
    if (category && !isLive(category))
      throw new Error("This menu category is unavailable.");
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 30
    )
      throw new Error("Invalid quantity.");
    return {
      id: meal.id,
      title: meal.title,
      quantity: line.quantity,
      price: visiblePrice(meal, s) ? (meal.price ?? null) : null,
    };
  }));
  const pending = items.some((i) => i.price === null);
  const subtotal = items.reduce(
    (sum, i) => sum + (i.price ?? 0) * i.quantity,
    0,
  );
  let discount = 0;
  let reward: Reward | undefined;
  let terms: Entry | undefined;
  if (coupon) {
    reward = await db()
      .prepare("SELECT * FROM rewards WHERE code=? AND customer_id=?")
      .get(coupon.toUpperCase(), customerId) as Reward | undefined;
    if (!reward || reward.status !== "claimed")
      throw new Error("This coupon is not available in your wallet.");
    if (Date.parse(reward.active_at) > Date.now())
      throw new Error("This coupon is not active yet.");
    if (Date.parse(reward.expires_at) <= Date.now())
      throw new Error("This coupon has expired.");
    terms = JSON.parse(reward.terms) as Entry;
    if (!pending) {
      if (subtotal < (terms.minOrder || 0))
        throw new Error("Your order does not meet this offer’s minimum spend.");
      discount =
        terms.discountType === "percent"
          ? Math.floor((subtotal * (terms.discountValue || 0)) / 100)
          : terms.discountValue || 0;
      if (terms.discountType === "free") {
        const free = items.find((i) => i.id === terms?.rewardItem);
        if (!free) throw new Error("Add the offer’s meal to your selection.");
        discount = free.price || 0;
      }
      if (terms.maxDiscount) discount = Math.min(discount, terms.maxDiscount);
      discount = Math.min(subtotal, discount);
    }
  }
  return {
    items,
    subtotal: pending ? null : subtotal,
    discount: pending ? null : discount,
    total: pending ? null : subtotal - discount,
    pending,
    rewardId: reward?.id || null,
  };
}
