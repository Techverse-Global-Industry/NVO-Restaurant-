import { z } from "zod";
const text = z.string().trim().max(5000);
const date = z
  .string()
  .max(40)
  .refine((v) => !v || Number.isFinite(Date.parse(v)), "Invalid date")
  .optional();
export const entrySchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
    kind: z.enum([
      "meals",
      "categories",
      "specials",
      "posts",
      "events",
      "testimonials",
      "loyalty",
      "campaigns",
    ]),
    title: z.string().trim().min(1).max(160),
    titleFr: text.optional(),
    description: text,
    descriptionFr: text.optional(),
    image: z
      .string()
      .max(500)
      .refine(
        (v) => !v || /^\/(images|uploads)\/[a-zA-Z0-9._-]+$/.test(v),
        "Use an uploaded image",
      )
      .optional(),
    category: text.optional(),
    price: z.number().int().min(0).max(10000000).nullable().optional(),
    priceVisibility: z.enum(["inherit", "show", "hide"]).optional(),
    active: z.boolean(),
    featured: z.boolean().optional(),
    available: z.boolean().optional(),
    preorder: z.boolean().optional(),
    sort: z.number().int().min(0).max(10000),
    startsAt: date,
    endsAt: date,
    badge: z.string().max(60).optional(),
    location: text.optional(),
    code: z.string().max(40).optional(),
    discountType: z.enum(["percent", "fixed", "free"]).optional(),
    discountValue: z.number().min(0).max(10000000).optional(),
    minOrder: z.number().int().min(0).max(10000000).optional(),
    maxDiscount: z.number().int().min(0).max(10000000).optional(),
    claimLimit: z.number().int().min(1).max(100000).optional(),
    perCustomerLimit: z.number().int().min(1).max(20).optional(),
    activationDays: z.number().int().min(0).max(365).optional(),
    validityDays: z.number().int().min(1).max(365).optional(),
    rewardItem: text.optional(),
    date,
    status: z.enum(["draft", "published"]).optional(),
    position: z.number().int().min(1).max(3).optional(),
    demo: z.boolean().optional(),
  })
  .superRefine((e, ctx) => {
    if (
      e.startsAt &&
      e.endsAt &&
      Date.parse(e.endsAt) <= Date.parse(e.startsAt)
    )
      ctx.addIssue({ code: "custom", message: "End must follow start" });
    if (e.discountType === "percent" && (e.discountValue || 0) > 100)
      ctx.addIssue({ code: "custom", message: "Percentage cannot exceed 100" });
    if (e.kind === "campaigns" && e.discountType === "free" && !e.rewardItem)
      ctx.addIssue({ code: "custom", message: "Choose the free meal" });
  });
export const settingsSchema = z.object({
  previewContent: z.boolean().optional(),
  name: z.string().min(1).max(100),
  whatsapp: z.string().regex(/^\d{8,15}$/),
  address: text,
  mapsUrl: z.url().refine((v) => {
    const h = new URL(v).hostname;
    return [
      "www.google.com",
      "maps.google.com",
      "maps.app.goo.gl",
      "goo.gl",
    ].includes(h);
  }, "Use a Google Maps URL"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  showPrices: z.boolean(),
  currency: z.literal("XOF"),
  email: z.union([z.email(), z.literal("")]),
  hours: text,
  instagram: z.union([
    z.url().refine((v) => new URL(v).protocol === "https:"),
    z.literal(""),
  ]),
  referralEnabled: z.boolean(),
  referralCampaign: text,
  referralClaimMinutes: z.number().int().min(1).max(1440),
});
export const orderSchema = z.object({
  lines: z
    .array(
      z.object({
        id: z.string().max(80),
        quantity: z.number().int().min(1).max(30),
      }),
    )
    .min(1)
    .max(40),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(30),
  notes: z.string().max(1000).default(""),
  method: z.enum(["pickup", "delivery", "dine-in"]),
  address: z.string().max(500).default(""),
  coupon: z.string().max(50).default(""),
  requestKey: z.string().min(16).max(100),
});
export const reservationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().min(6).max(30),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  guests: z.number().int().min(1).max(100),
  message: z.string().max(1000).default(""),
});
