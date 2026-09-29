import { z } from "zod";
import { captionLimits, type Platform } from "./types";
export const planSchema = z.object({
  mode: z.enum(["auto", "selected", "off"]).default("auto"),
  accounts: z.array(z.string().max(80)).max(20).default([]),
  language: z.enum(["en", "fr"]).default("fr"),
  captionSource: z.enum(["standard", "ai"]).default("standard"),
  tiktokConsent: z.boolean().default(false),
  captions: z
    .object({
      facebook: z.string().trim().max(10000).optional(),
      instagram: z.string().trim().max(10000).optional(),
      tiktok: z.string().trim().max(10000).optional(),
      whatsapp: z.string().trim().max(10000).optional(),
    })
    .default({}),
});
export function validateCaption(platform: Platform, caption: string) {
  if (typeof caption !== "string" || !caption.trim())
    throw new Error("Write a caption before publishing.");
  if (caption.length > captionLimits[platform])
    throw new Error(
      `The ${platform} caption is too long. Prepare and shorten that caption in the post editor, keeping the offer conditions.`,
    );
  if (platform === "whatsapp" && !/\bSTOP\b/i.test(caption))
    throw new Error(
      "Include STOP unsubscribe instructions in the WhatsApp caption.",
    );
  if (
    platform === "instagram" &&
    (caption.match(/#[\p{L}\p{N}_]+/gu) || []).length > 5
  )
    throw new Error("Use no more than five focused Instagram hashtags.");
  return caption.trim();
}
