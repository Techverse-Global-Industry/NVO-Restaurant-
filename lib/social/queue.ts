import { randomUUID } from "node:crypto";
import { db, entry, settings, transaction } from "../db";
import type { Entry } from "../types";
import { accounts, account } from "./accounts";
import {
  defaultPlan,
  type SocialPlan,
  type Job,
  type JobStatus,
} from "./types";
import { planSchema, validateCaption } from "./validation";
import { payloadFor } from "./captions";
import { publicSite, sha } from "./security";
export const socialKinds = ["posts", "events", "specials"];
export function getPlan(id: string): SocialPlan {
  const row = db()
    .prepare("SELECT data FROM social_plans WHERE entry_id=?")
    .get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : { ...defaultPlan };
}
export function eligible(e: Entry | undefined) {
  return (
    !!e &&
    socialKinds.includes(e.kind) &&
    !!e.active &&
    e.status !== "draft" &&
    !e.demo &&
    (!e.endsAt || Date.parse(e.endsAt) > Date.now()) &&
    (!(e.kind === "events" && e.date) || Date.parse(e.date!) > Date.now())
  );
}
export function cancelPending(entryId: string) {
  db()
    .prepare(
      "UPDATE social_jobs SET status='cancelled',lease_owner=NULL,lease_until=NULL,updated_at=? WHERE entry_id=? AND status IN ('queued','retry','preparing','failed','needs_auth','ready')",
    )
    .run(new Date().toISOString(), entryId);
}
// Called inside the SAME transaction as the website entry save. No network work here.
export function queueEntry(e: Entry, input?: unknown) {
  if (!socialKinds.includes(e.kind)) return;
  const plan = input === undefined ? getPlan(e.id) : planSchema.parse(input);
  db()
    .prepare("INSERT OR REPLACE INTO social_plans VALUES(?,?)")
    .run(e.id, JSON.stringify({ ...plan, tiktokConsent: false }));
  const selected = accounts().filter(
    (a) =>
      a.status !== "disconnected" &&
      (plan.mode === "selected"
        ? plan.accounts.includes(a.id)
        : plan.mode === "auto" && a.auto_publish === 1),
  );
  const wanted = eligible(e) ? selected : [];
  const existing = db()
    .prepare("SELECT * FROM social_jobs WHERE entry_id=?")
    .all(e.id) as Job[];
  for (const j of existing)
    if (
      !wanted.some((a) => a.id === j.account_id) &&
      [
        "queued",
        "retry",
        "preparing",
        "failed",
        "needs_auth",
        "ready",
      ].includes(j.status)
    )
      db()
        .prepare(
          "UPDATE social_jobs SET status='cancelled',lease_owner=NULL,lease_until=NULL,updated_at=? WHERE id=?",
        )
        .run(new Date().toISOString(), j.id);
  for (const a of wanted) {
    const previous = existing.find((j) => j.account_id === a.id);
    if (
      previous &&
      [
        "publishing",
        "published",
        "needs_review",
        "processing",
        "inbox",
      ].includes(previous.status)
    )
      continue;
    const payload = payloadFor(
      e,
      plan.language,
      plan.captionSource,
      settings(),
      process.env.SITE_URL || "http://localhost:3000",
    );
    if (a.platform === "tiktok" && plan.tiktokConsent && !plan.captions.tiktok)
      throw new Error(
        "Review and provide the TikTok caption before confirming its upload.",
      );
    payload.caption = plan.captions[a.platform] || undefined;
    const serialized = JSON.stringify(payload),
      revision = sha(serialized);
    if (previous?.revision === revision && previous.status !== "cancelled")
      continue;
    // TikTok requires an explicit upload choice for each new or changed post.
    if (a.platform === "tiktok" && !plan.tiktokConsent) {
      if (previous)
        db()
          .prepare(
            "UPDATE social_jobs SET status='cancelled',lease_owner=NULL,lease_until=NULL,last_error='Review and confirm the changed TikTok upload.',updated_at=? WHERE id=?",
          )
          .run(new Date().toISOString(), previous.id);
      continue;
    }
    let error: string | null = null;
    try {
      publicSite();
      if (payload.caption) validateCaption(a.platform, payload.caption);
      if (!e.image)
        throw new Error("Choose a restaurant photo before sharing this post.");
    } catch (err) {
      error = (err as Error).message;
    }
    const status: JobStatus = error
      ? "failed"
      : a.status === "reconnect"
        ? "needs_auth"
        : "queued";
    const now = new Date().toISOString();
    const start = Math.max(Date.now(), e.startsAt ? Date.parse(e.startsAt) : 0);
    // Existing WhatsApp deliveries are retained; a post can never resend to a recipient automatically.
    db()
      .prepare(
        "INSERT INTO social_jobs(id,entry_id,account_id,revision,payload,status,next_attempt,last_error,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(entry_id,account_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,status=excluded.status,next_attempt=excluded.next_attempt,last_error=excluded.last_error,container_id=NULL,media_url=NULL,attempts=0,lease_owner=NULL,lease_until=NULL,updated_at=excluded.updated_at",
      )
      .run(
        previous?.id || randomUUID(),
        e.id,
        a.id,
        revision,
        serialized,
        status,
        start,
        error,
        now,
        now,
      );
  }
}
export function jobs() {
  return (
    db()
      .prepare(
        "SELECT j.*,a.platform,a.name FROM social_jobs j JOIN social_accounts a ON a.id=j.account_id ORDER BY j.created_at DESC LIMIT 100",
      )
      .all() as (Job & { platform: string; name: string })[]
  ).map((j) => {
    const p = JSON.parse(j.payload);
    return {
      id: j.id,
      entry_id: j.entry_id,
      account_id: j.account_id,
      platform: j.platform,
      name: j.name,
      title: p.entry.title,
      image: p.entry.image,
      caption: p.caption || "",
      status: j.status,
      attempts: j.attempts,
      next_attempt: j.next_attempt,
      last_error: j.last_error,
      permalink: j.permalink,
      provider_id: j.provider_id,
      created_at: j.created_at,
      deliveries:
        j.platform === "whatsapp"
          ? db()
              .prepare(
                "SELECT status,count(*) AS count FROM whatsapp_deliveries WHERE job_id=? GROUP BY status",
              )
              .all(j.id)
          : [],
    };
  });
}
export function jobAction(
  id: string,
  action: "cancel" | "retry",
  checked = false,
) {
  transaction(() => {
    const j = db().prepare("SELECT * FROM social_jobs WHERE id=?").get(id) as
      Job | undefined;
    if (!j) throw new Error("Post not found.");
    if (action === "cancel") {
      if (
        [
          "publishing",
          "published",
          "processing",
          "inbox",
          "needs_review",
        ].includes(j.status)
      )
        throw new Error(
          "This post may already be on the platform. Manage it there.",
        );
      db()
        .prepare(
          "UPDATE social_jobs SET status='cancelled',lease_owner=NULL,lease_until=NULL,updated_at=? WHERE id=?",
        )
        .run(new Date().toISOString(), id);
      return;
    }
    if (
      !["failed", "needs_auth", "needs_review", "cancelled"].includes(j.status)
    )
      throw new Error("This post is already being handled.");
    if (j.status === "needs_review" && !checked)
      throw new Error(
        "Check the destination for this post before retrying, to avoid a duplicate.",
      );
    if (!eligible(entry(j.entry_id)))
      throw new Error(
        "Publish an active, genuine website post before retrying.",
      );
    if (account(j.account_id)?.status !== "connected")
      throw new Error("Reconnect the account first.");
    publicSite();
    if (!JSON.parse(j.payload).entry.image)
      throw new Error("Edit the website post and add a photo first.");
    db()
      .prepare(
        "UPDATE social_jobs SET container_id=NULL,media_url=NULL WHERE id=?",
      )
      .run(id);
    if (j.status === "failed" && account(j.account_id)?.platform === "tiktok")
      db()
        .prepare("UPDATE social_jobs SET provider_id=NULL WHERE id=?")
        .run(id);
    db()
      .prepare(
        "UPDATE social_jobs SET status='queued',attempts=0,next_attempt=?,lease_owner=NULL,lease_until=NULL,last_error=NULL,updated_at=? WHERE id=?",
      )
      .run(Date.now(), new Date().toISOString(), id);
    if (checked)
      db()
        .prepare(
          "UPDATE whatsapp_deliveries SET status='queued',attempts=0,next_attempt=? WHERE job_id=? AND status='needs_review'",
        )
        .run(Date.now(), id);
    db()
      .prepare(
        "UPDATE whatsapp_deliveries SET status='queued',attempts=0,next_attempt=? WHERE job_id=? AND status='failed'",
      )
      .run(Date.now(), id);
  });
}
