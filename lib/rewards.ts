import { randomBytes, randomUUID } from "node:crypto";
import { db, entry, settings, transaction } from "./db";
import { isLive } from "./catalog";
import type { Entry, Reward } from "./types";
export async function issueReward(
  campaign: Entry,
  customerId: string,
  referralId: string | null = null,
  identity?: { name: string; network: string },
) {
  const now = new Date();
  const active = new Date(
    now.getTime() + (campaign.activationDays || 0) * 86400000,
  );
  const expires = new Date(
    active.getTime() + (campaign.validityDays || 7) * 86400000,
  );
  const id = randomUUID(),
    code = "NVO-" + randomBytes(5).toString("hex").toUpperCase();
  await db()
    .prepare(
      "INSERT INTO rewards(id,code,customer_id,campaign_id,title,status,claimed_at,active_at,expires_at,terms,referral_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    )
    .run(
      id,
      code,
      customerId,
      campaign.id,
      campaign.title,
      "claimed",
      now.toISOString(),
      active.toISOString(),
      expires.toISOString(),
      JSON.stringify(campaign),
      referralId,
    );
  if (identity)
    await db()
      .prepare("UPDATE rewards SET claimant_name=?,network_hash=? WHERE id=?")
      .run(identity.name, identity.network, id);
  return (await db().prepare("SELECT * FROM rewards WHERE id=?").get<Reward>(id))!;
}
export async function claim(
  campaignId: string,
  customerId: string,
  referralId?: string,
  identity?: { name: string; network: string },
) {
  return transaction(async () => {
    const c = await entry(campaignId);
    if (!c || c.kind !== "campaigns" || !isLive(c))
      throw new Error("This offer is not open for claims.");
    if (
      identity &&
      await db()
        .prepare(
          "SELECT id FROM rewards WHERE campaign_id=? AND network_hash=?",
        )
        .get(c.id, identity.network)
    )
      throw new Error(
        "This offer has already been claimed on your network. One coupon per IP address, including shared Wi-Fi. / Cette offre a déjà été réclamée sur votre réseau.",
      );
    const count = (
      await db()
        .prepare("SELECT count(*) AS n FROM rewards WHERE campaign_id=?")
        .get(c.id) as { n: number }
    ).n;
    if (count >= (c.claimLimit || 10))
      throw new Error("All rewards in this offer have been claimed.");
    const mine = (
      await db()
        .prepare(
          "SELECT count(*) AS n FROM rewards WHERE campaign_id=? AND customer_id=?",
        )
        .get(c.id, customerId) as { n: number }
    ).n;
    if (mine >= 1)
      throw new Error(
        "You have already claimed this offer. Check your wallet.",
      );
    if (referralId) {
      const s = await settings();
      if (!s.referralEnabled || s.referralCampaign !== c.id)
        throw new Error("Referral offers are not active.");
      const ref = await db()
        .prepare("SELECT * FROM referrals WHERE id=?")
        .get(referralId) as { customer_id: string } | undefined;
      const visit = await db()
        .prepare(
          "SELECT opened_at FROM referral_visits WHERE referral_id=? AND customer_id=?",
        )
        .get(referralId, customerId) as { opened_at: string } | undefined;
      if (!ref || ref.customer_id === customerId || !visit)
        throw new Error("This referral is not eligible.");
      if (
        Date.parse(visit.opened_at) + s.referralClaimMinutes * 60000 <=
        Date.now()
      )
        throw new Error("The referral claim window has ended.");
    }
    return issueReward(c, customerId, referralId || null, identity);
  });
}
