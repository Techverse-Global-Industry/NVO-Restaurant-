import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db, audit, transaction, entries } from "./db";
import type { Entry, Reward } from "./types";
export const claimantName = z
  .string()
  .trim()
  .min(2, "Please enter your name / Indiquez votre nom.")
  .max(80)
  .refine((v) => !/[\u0000-\u001f<>]/.test(v), "Please enter a valid name.");
export function publicReward(r: Reward) {
  const {
    id,
    code,
    campaign_id,
    title,
    status,
    claimed_at,
    active_at,
    expires_at,
    claimant_name,
    saved_at,
  } = r;
  const t = JSON.parse(r.terms) as Entry;
  return {
    id,
    code,
    campaign_id,
    title,
    status,
    claimed_at,
    active_at,
    expires_at,
    claimant_name,
    saved_at,
    offer: {
      title: t.title,
      titleFr: t.titleFr,
      description: t.description,
      descriptionFr: t.descriptionFr,
      discountType: t.discountType,
      discountValue: t.discountValue,
      minOrder: t.minOrder,
      maxDiscount: t.maxDiscount,
      rewardItem: t.rewardItem,
    },
  };
}
export function couponAvailability(customer: string | null, network: string) {
  return entries()
    .filter((e) => e.kind === "campaigns")
    .map((e) => {
      const count = (
        db()
          .prepare("SELECT count(*) AS n FROM rewards WHERE campaign_id=?")
          .get(e.id) as { n: number }
      ).n;
      const claimed = !!db()
        .prepare(
          "SELECT id FROM rewards WHERE campaign_id=? AND (customer_id=? OR network_hash=?) LIMIT 1",
        )
        .get(e.id, customer || "", network);
      return {
        id: e.id,
        remaining: Math.max(0, (e.claimLimit || 10) - count),
        claimed,
      };
    });
}
export function lookupCoupon(code: string) {
  const reward = db()
    .prepare("SELECT * FROM rewards WHERE code=?")
    .get(code.trim().toUpperCase()) as Reward | undefined;
  if (!reward) throw new Error("Coupon not found. Check the unique code.");
  return reward;
}
export function nameLegacyCoupon(
  id: string,
  customerId: string,
  name: unknown,
  network: string,
) {
  const validName = claimantName.parse(name);
  return transaction(() => {
    const reward = db()
      .prepare("SELECT * FROM rewards WHERE id=? AND customer_id=?")
      .get(id, customerId) as Reward | undefined;
    if (!reward) throw new Error("Coupon not found in your wallet.");
    if (reward.claimant_name)
      throw new Error(
        "This coupon already has a registered name. Ask NVO if a correction is needed.",
      );
    if (reward.status !== "claimed")
      throw new Error("Ask NVO to check the name on this coupon.");
    db()
      .prepare(
        "UPDATE rewards SET claimant_name=?,network_hash=coalesce(network_hash,?) WHERE id=?",
      )
      .run(validName, network, id);
    return publicReward({ ...reward, claimant_name: validName });
  });
}
const saleSchema = z.object({
  code: z.string().max(50),
  name: claimantName,
  reference: z.string().trim().max(100).default(""),
  paid: z.literal(true, {
    error: "Confirm payment before recording redemption.",
  }),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        mealId: z.string().max(80).optional(),
        quantity: z.number().int().min(1).max(30),
        unitPrice: z.number().int().min(0).max(10000000),
      }),
    )
    .min(1)
    .max(40),
});
export function counterQuote(input: unknown) {
  const sale = saleSchema.parse(input);
  const reward = lookupCoupon(sale.code);
  if (reward.status !== "claimed")
    throw new Error(
      reward.status === "held"
        ? "This coupon is attached to a website order. Complete or cancel that order first."
        : "This coupon has already been used.",
    );
  if (Date.parse(reward.active_at) > Date.now())
    throw new Error("This coupon is not active yet.");
  if (Date.parse(reward.expires_at) <= Date.now())
    throw new Error("This coupon has expired.");
  const normalize = (v: string) =>
    v.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  if (
    reward.claimant_name &&
    normalize(sale.name) !== normalize(reward.claimant_name)
  )
    throw new Error("The customer's name must match the coupon card.");
  const terms = JSON.parse(reward.terms) as Entry;
  const subtotal = sale.items.reduce(
    (sum, i) => sum + i.quantity * i.unitPrice,
    0,
  );
  if (subtotal < (terms.minOrder || 0))
    throw new Error(`Minimum spend for this coupon: ${terms.minOrder} FCFA.`);
  let discount =
    terms.discountType === "percent"
      ? Math.floor((subtotal * (terms.discountValue || 0)) / 100)
      : terms.discountValue || 0;
  if (terms.discountType === "free") {
    const item = sale.items.find((i) => i.mealId === terms.rewardItem);
    if (!item)
      throw new Error(
        "Add the offer's free dish to the receipt using the menu selector.",
      );
    discount = item.unitPrice;
  }
  if (terms.maxDiscount) discount = Math.min(discount, terms.maxDiscount);
  discount = Math.min(discount, subtotal);
  return { sale, reward, subtotal, discount, total: subtotal - discount };
}
export function redeemCounter(input: unknown, staffId: string) {
  return transaction(() => {
    const q = counterQuote(input);
    const now = new Date().toISOString();
    const id =
      "NVO-SALE-" +
      now.slice(0, 10).replaceAll("-", "") +
      "-" +
      randomBytes(4).toString("hex").toUpperCase();
    const receipt = {
      ...q.sale,
      subtotal: q.subtotal,
      discount: q.discount,
      total: q.total,
      id,
      created_at: now,
    };
    db()
      .prepare("INSERT INTO counter_sales VALUES(?,?,?,?,?)")
      .run(id, q.reward.id, staffId, JSON.stringify(receipt), now);
    db()
      .prepare(
        "UPDATE rewards SET status='redeemed',order_id=?,claimant_name=coalesce(claimant_name,?) WHERE id=? AND status='claimed'",
      )
      .run(id, q.sale.name, q.reward.id);
    audit(staffId, "counter_coupon_redeemed:" + id, q.reward.id);
    return receipt;
  });
}
