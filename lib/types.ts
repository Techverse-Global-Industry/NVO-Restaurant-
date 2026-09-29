export type Kind =
  | "meals"
  | "categories"
  | "specials"
  | "posts"
  | "events"
  | "testimonials"
  | "loyalty"
  | "campaigns";
export type Entry = {
  id: string;
  kind: Kind;
  title: string;
  titleFr?: string;
  description: string;
  descriptionFr?: string;
  image?: string;
  category?: string;
  price?: number | null;
  priceVisibility?: "inherit" | "show" | "hide";
  active: boolean;
  featured?: boolean;
  available?: boolean;
  preorder?: boolean;
  sort: number;
  startsAt?: string;
  endsAt?: string;
  badge?: string;
  location?: string;
  code?: string;
  discountType?: "percent" | "fixed" | "free";
  discountValue?: number;
  minOrder?: number;
  maxDiscount?: number;
  claimLimit?: number;
  perCustomerLimit?: number;
  activationDays?: number;
  validityDays?: number;
  rewardItem?: string;
  date?: string;
  status?: "draft" | "published";
  position?: number;
  demo?: boolean;
};
export type Settings = {
  previewContent?: boolean;
  name: string;
  whatsapp: string;
  address: string;
  mapsUrl: string;
  latitude: number;
  longitude: number;
  showPrices: boolean;
  currency: string;
  email: string;
  hours: string;
  instagram: string;
  referralEnabled: boolean;
  referralCampaign: string;
  referralClaimMinutes: number;
};
export type PublicData = { settings: Settings; entries: Entry[] };
export type CartLine = { id: string; quantity: number };
export type Role = "owner" | "manager" | "content" | "service" | "analyst";
export type Staff = { id: string; email: string; role: Role };
export type Reward = {
  claimant_name?: string;
  saved_at?: string;
  id: string;
  code: string;
  campaign_id: string;
  title: string;
  status: string;
  claimed_at: string;
  active_at: string;
  expires_at: string;
  terms: string;
  order_id?: string;
};
