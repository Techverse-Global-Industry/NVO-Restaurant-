import { randomUUID } from "node:crypto";
import { db, entry, transaction } from "../db";
import { account } from "./accounts";
import { eligible } from "./queue";
import { generateCaptions } from "./captions";
import { prepareImage, cleanExpiredMedia } from "./media";
import { accountToken, graph, tiktok, ProviderError } from "./providers";
import { broadcast } from "./whatsapp";
import { validateCaption } from "./validation";
import { publicSite } from "./security";
import type { Job, JobStatus, SocialPayload } from "./types";
const leaseMs = 180000;
export function recoverExpired() {
  const now = Date.now();
  db()
    .prepare(
      "UPDATE social_jobs SET status='retry',lease_owner=NULL,lease_until=NULL WHERE status='preparing' AND lease_until<?",
    )
    .run(now);
  db()
    .prepare(
      "UPDATE social_jobs SET status='needs_review',last_error='Publishing was interrupted. Check the destination before retrying.',lease_owner=NULL,lease_until=NULL WHERE status='publishing' AND lease_until<?",
    )
    .run(now);
  db()
    .prepare(
      "UPDATE whatsapp_deliveries SET status='needs_review',last_error='Sending was interrupted. Check before retrying.' WHERE status='sending' AND job_id IN (SELECT id FROM social_jobs WHERE status='needs_review')",
    )
    .run();
}
export function claimJob(): Job | undefined {
  return transaction(() => {
    recoverExpired();
    const row = db()
      .prepare(
        "SELECT j.* FROM social_jobs j WHERE j.status IN ('queued','retry','processing','inbox') AND j.next_attempt<=? AND NOT EXISTS (SELECT 1 FROM social_jobs busy WHERE busy.account_id=j.account_id AND busy.status IN ('preparing','publishing')) ORDER BY j.next_attempt,j.created_at LIMIT 1",
      )
      .get(Date.now()) as Job | undefined;
    if (!row) return;
    const owner = randomUUID();
    db()
      .prepare(
        "UPDATE social_jobs SET status='preparing',attempts=attempts+1,lease_owner=?,lease_until=?,updated_at=? WHERE id=?",
      )
      .run(owner, Date.now() + leaseMs, new Date().toISOString(), row.id);
    return {
      ...row,
      lease_owner: owner,
      lease_until: Date.now() + leaseMs,
      attempts: row.attempts + 1,
    };
  });
}
export async function processJob(
  j: Job,
  fetcher: typeof fetch = fetch,
  prepare: typeof prepareImage = prepareImage,
) {
  const a = account(j.account_id);
  const owns = () => {
    const row = db()
      .prepare(
        "SELECT status,lease_owner,lease_until FROM social_jobs WHERE id=?",
      )
      .get(j.id) as Job | undefined;
    return (
      !!row &&
      row.lease_owner === j.lease_owner &&
      (row.lease_until || 0) > Date.now() &&
      ["preparing", "publishing"].includes(row.status) &&
      account(j.account_id)?.status === "connected"
    );
  };
  const update = (fields: Partial<Job>) => {
    const names = Object.keys(fields);
    if (!names.length) return;
    db()
      .prepare(
        `UPDATE social_jobs SET ${names.map((n) => `${n}=?`).join(",")},updated_at=? WHERE id=? AND lease_owner=?`,
      )
      .run(
        ...(Object.values(fields) as (string | number | null)[]),
        new Date().toISOString(),
        j.id,
        j.lease_owner,
      );
  };
  const finish = (
    status: JobStatus,
    error: string | null = null,
    next = Date.now(),
  ) => {
    update({
      status,
      last_error: error,
      next_attempt: next,
      lease_owner: null,
      lease_until: null,
    });
    db()
      .prepare("INSERT INTO social_attempts VALUES(?,?,?,?,?)")
      .run(
        randomUUID(),
        j.id,
        status,
        error || status,
        new Date().toISOString(),
      );
  };
  try {
    if (!a || a.status !== "connected") {
      finish("needs_auth", "Reconnect this account to continue.");
      return;
    }
    const p: SocialPayload = JSON.parse(j.payload);
    const alreadyTransferred = !!j.provider_id && a.platform === "tiktok";
    if (!alreadyTransferred && !eligible(entry(j.entry_id))) {
      finish("cancelled", "The website post is hidden, a sample, or expired.");
      return;
    }
    if (
      !alreadyTransferred &&
      p.entry.startsAt &&
      Date.parse(p.entry.startsAt) > Date.now()
    ) {
      finish("queued", null, Date.parse(p.entry.startsAt));
      return;
    }
    publicSite();
    const token = await accountToken(a, fetcher);
    if (alreadyTransferred) {
      const status = await tiktok(
        "post/publish/status/fetch/",
        token,
        { publish_id: j.provider_id },
        false,
        fetcher,
      );
      if (status.status === "PUBLISH_COMPLETE") {
        const remote = status.publicaly_available_post_id?.[0];
        if (remote)
          update({
            permalink: `https://www.tiktok.com/share/video/${encodeURIComponent(String(remote))}`,
          });
        finish("published");
      } else if (status.status === "FAILED")
        finish(
          "failed",
          "TikTok could not finish this upload. Check the photo and account in TikTok.",
        );
      else if (Date.now() - Date.parse(j.created_at) > 7 * 86400000)
        finish(
          "needs_review",
          "Open TikTok to check this older upload. Its final status has not been confirmed.",
        );
      else
        finish(
          status.status === "SEND_TO_USER_INBOX" ? "inbox" : "processing",
          null,
          Date.now() +
            (status.status === "SEND_TO_USER_INBOX" ? 300000 : 15000),
        );
      return;
    }
    if (!p.caption) {
      p.caption = (
        await generateCaptions(p, p.captionSource === "ai", fetcher)
      ).captions[a.platform];
      if (!owns()) return;
      update({ payload: JSON.stringify(p) });
    }
    const caption = validateCaption(a.platform, p.caption);
    if (!p.entry.image)
      throw new ProviderError(
        "Choose a photo in the website post before sharing.",
        "failed",
      );
    let media = j.media_url;
    if (!media) {
      media = await prepare(p.entry.image);
      if (!owns()) return;
      update({ media_url: media });
    }
    if (!owns()) return;
    if (a.platform === "whatsapp") {
      update({ status: "publishing" });
      const result = await broadcast(
        j,
        a,
        token,
        caption,
        media,
        p.language,
        owns,
        fetcher,
      );
      if (!owns()) return;
      finish(
        result,
        result === "needs_review"
          ? "Some messages need checking before retrying."
          : result === "failed"
            ? "Some subscribers did not receive this post. Check delivery details before retrying."
            : null,
        Date.now() + 15000,
      );
      return;
    }
    let container = j.container_id;
    if (a.platform === "facebook" && !container) {
      const photo = await graph(
        `${a.remote_id}/photos`,
        token,
        { url: media, published: "false" },
        "POST",
        false,
        fetcher,
      );
      if (!photo.id)
        throw new ProviderError("Facebook did not accept the photo.", "failed");
      container = String(photo.id);
      if (!owns()) return;
      update({ container_id: container });
    }
    if (a.platform === "instagram") {
      if (!container) {
        const prepared = await graph(
          `${a.remote_id}/media`,
          token,
          {
            image_url: media,
            caption,
            alt_text: (p.language === "fr"
              ? p.entry.titleFr || p.entry.title
              : p.entry.title
            ).slice(0, 1000),
          },
          "POST",
          false,
          fetcher,
        );
        if (!prepared.id)
          throw new ProviderError(
            "Instagram did not accept the photo.",
            "failed",
          );
        container = String(prepared.id);
        if (!owns()) return;
        update({ container_id: container });
      }
      const ready = await graph(
        container!,
        token,
        { fields: "status_code" },
        "GET",
        false,
        fetcher,
      );
      if (ready.status_code === "IN_PROGRESS") {
        finish("retry", null, Date.now() + 15000);
        return;
      }
      if (ready.status_code !== "FINISHED")
        throw new ProviderError(
          "Instagram could not prepare the photo. Edit the post or retry with a new photo.",
          "failed",
        );
    }
    if (!owns()) return;
    if (!eligible(entry(j.entry_id))) {
      finish("cancelled", "The website post expired before publishing.");
      return;
    }
    update({ status: "publishing" });
    if (!owns()) return;
    let result: any;
    if (a.platform === "facebook")
      result = await graph(
        `${a.remote_id}/feed`,
        token,
        {
          message: caption,
          attached_media: JSON.stringify([{ media_fbid: container }]),
        },
        "POST",
        true,
        fetcher,
      );
    else if (a.platform === "instagram")
      result = await graph(
        `${a.remote_id}/media_publish`,
        token,
        { creation_id: container! },
        "POST",
        true,
        fetcher,
      );
    else
      result = await tiktok(
        "post/publish/content/init/",
        token,
        {
          media_type: "PHOTO",
          post_mode: "MEDIA_UPLOAD",
          post_info: {
            title: (p.language === "fr"
              ? p.entry.titleFr || p.entry.title
              : p.entry.title
            ).slice(0, 90),
            description: caption,
          },
          source_info: {
            source: "PULL_FROM_URL",
            photo_images: [media],
            photo_cover_index: 0,
          },
        },
        true,
        fetcher,
      );
    const id = result.id || result.publish_id;
    if (!id)
      throw new ProviderError(
        "The platform did not return a publishing receipt. Check before retrying.",
        "uncertain",
      );
    update({ provider_id: String(id) });
    if (a.platform === "tiktok") {
      finish("processing", null, Date.now() + 15000);
      return;
    }
    // The post receipt is durable before the optional permalink lookup.
    finish("published");
    try {
      const info = await graph(
        String(id),
        token,
        { fields: a.platform === "instagram" ? "permalink" : "permalink_url" },
        "GET",
        false,
        fetcher,
      );
      const link = info.permalink || info.permalink_url;
      if (
        typeof link === "string" &&
        /^https:\/\/(www\.)?(facebook|instagram)\.com\//.test(link)
      )
        db()
          .prepare("UPDATE social_jobs SET permalink=? WHERE id=?")
          .run(link, j.id);
    } catch {
      /* A missing permalink does not invalidate a confirmed post. */
    }
  } catch (err) {
    const e =
      err instanceof ProviderError
        ? err
        : new ProviderError(
            err instanceof Error ? err.message : "Unable to prepare this post.",
            "failed",
          );
    if (e.kind === "auth") {
      db()
        .prepare(
          "UPDATE social_accounts SET status='reconnect',updated_at=? WHERE id=? AND status='connected'",
        )
        .run(new Date().toISOString(), j.account_id);
      finish("needs_auth", e.message);
    } else
      finish(
        e.kind === "uncertain"
          ? "needs_review"
          : e.kind === "retry" && j.attempts < 6
            ? "retry"
            : "failed",
        e.message,
        Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(j.attempts, 7)),
      );
  }
}
let lastMaintenance = 0;
export async function tick(fetcher: typeof fetch = fetch) {
  if (Date.now() - lastMaintenance > 3600000) {
    await cleanExpiredMedia();
    db().prepare("DELETE FROM social_oauth WHERE expires_at<?").run(Date.now());
    db()
      .prepare("DELETE FROM social_caption_cache WHERE created_at<?")
      .run(new Date(Date.now() - 30 * 86400000).toISOString());
    lastMaintenance = Date.now();
  }
  db()
    .prepare("INSERT OR REPLACE INTO social_worker VALUES(1,?)")
    .run(Date.now());
  for (let n = 0; n < 4; n++) {
    const j = claimJob();
    if (!j) break;
    await processJob(j, fetcher);
    db()
      .prepare("INSERT OR REPLACE INTO social_worker VALUES(1,?)")
      .run(Date.now());
  }
}
const globalWorker = globalThis as unknown as {
  nvoSocialTimer?: ReturnType<typeof setInterval>;
  nvoSocialBusy?: boolean;
};
export function startWorker() {
  if (globalWorker.nvoSocialTimer) return;
  const run = async () => {
    if (globalWorker.nvoSocialBusy) return;
    globalWorker.nvoSocialBusy = true;
    try {
      await tick();
    } catch {
      console.error(
        "NVO social worker could not finish a cycle; inspect database access and worker health.",
      );
    } finally {
      globalWorker.nvoSocialBusy = false;
    }
  };
  globalWorker.nvoSocialTimer = setInterval(() => void run(), 10000);
  globalWorker.nvoSocialTimer.unref();
  void run();
}
