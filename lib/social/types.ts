import type { Entry } from "../types";
export type Platform = "facebook" | "instagram" | "tiktok" | "whatsapp";
export type Language = "en" | "fr";
export type SocialPlan = {
  mode: "auto" | "selected" | "off";
  accounts: string[];
  language: Language;
  captions: Partial<Record<Platform, string>>;
  captionSource: "standard" | "ai";
  tiktokConsent?: boolean;
};
export type Account = {
  id: string;
  platform: Platform;
  remote_id: string;
  name: string;
  token: string;
  expires_at: number | null;
  status: "connected" | "reconnect" | "disconnected";
  auto_publish: boolean | number;
  created_at: string;
  updated_at: string;
};
export type PublicAccount = Omit<Account, "token">;
export type JobStatus =
  | "queued"
  | "preparing"
  | "retry"
  | "publishing"
  | "published"
  | "failed"
  | "needs_review"
  | "needs_auth"
  | "cancelled"
  | "processing"
  | "inbox"
  | "ready";
export type SocialPayload = {
  entry: Entry;
  language: Language;
  caption?: string;
  captionSource: "standard" | "ai";
  whatsapp: string;
  restaurant: string;
  address: string;
  siteUrl: string;
};
export type Job = {
  id: string;
  entry_id: string;
  account_id: string;
  revision: string;
  payload: string;
  status: JobStatus;
  attempts: number;
  next_attempt: number;
  lease_until: number | null;
  lease_owner: string | null;
  container_id: string | null;
  media_url: string | null;
  provider_id: string | null;
  permalink: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};
export const defaultPlan: SocialPlan = {
  mode: "auto",
  accounts: [],
  language: "fr",
  captions: {},
  captionSource: "standard",
};
export const platformNames: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
};
export const captionLimits: Record<Platform, number> = {
  facebook: 5000,
  instagram: 2200,
  tiktok: 4000,
  whatsapp: 900,
};
export type Captions = Record<Platform, string>;
