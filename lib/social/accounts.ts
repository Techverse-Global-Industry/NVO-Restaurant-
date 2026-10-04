import { randomBytes, randomUUID } from "node:crypto";
import { db, transaction } from "../db";
import { graph, instagramGraph, tiktok, tiktokToken } from "./providers";
import {
  publicSite,
  metaVersion,
  sha,
  seal,
  unseal,
  connectionReadiness,
  instagramReadiness,
} from "./security";
import type { Account, Platform, PublicAccount } from "./types";
export type Candidate = {
  id: string;
  platform: Platform;
  remote_id: string;
  name: string;
  token: string;
  expires_at: number | null;
};
type State = {
  state: string;
  cookie_hash: string;
  staff_id: string;
  expires_at: number;
  consumed: boolean | number;
  candidates: string | null;
};
export async function accounts(): Promise<PublicAccount[]> {
  return await db()
    .prepare(
      "SELECT id,platform,remote_id,name,expires_at,status,auto_publish,created_at,updated_at FROM social_accounts ORDER BY platform,name",
    )
    .all() as PublicAccount[];
}
export async function account(id: string) {
  return await db().prepare("SELECT * FROM social_accounts WHERE id=?").get(id) as
    Account | undefined;
}
export function tiktokReadiness() {
  const reasons: string[] = [];
  try {
    publicSite();
    seal("check", "check");
  } catch {
    reasons.push(
      "A public HTTPS website and social account protection are required.",
    );
  }
  if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET)
    reasons.push("The owner's TikTok app has not been configured.");
  return { ready: !reasons.length, reasons };
}
export type ConnectionProvider = "meta" | "instagram" | "tiktok";
export async function beginConnection(staffId: string, provider: ConnectionProvider) {
  const ready = provider === "meta" ? connectionReadiness() : provider === "instagram" ? instagramReadiness() : tiktokReadiness();
  if (!ready.ready) throw new Error(ready.reasons.join(" "));
  const state = randomBytes(24).toString("hex"),
    cookie = randomBytes(24).toString("hex"),
    hashed = sha(state);
  await db()
    .prepare("DELETE FROM social_oauth WHERE expires_at<? OR staff_id=?")
    .run(Date.now(), staffId);
  await db()
    .prepare("INSERT INTO social_oauth VALUES(?,?,?,?,false,?)")
    .run(
      hashed,
      sha(cookie),
      staffId,
      Date.now() + 600000,
      seal(JSON.stringify({ provider }), hashed),
    );
  const callback = `${publicSite()}/api/social/callback/${provider}`;
  const url = new URL(
    provider === "meta"
      ? `https://www.facebook.com/${metaVersion()}/dialog/oauth`
      : provider === "instagram"
        ? "https://www.instagram.com/oauth/authorize"
        : "https://www.tiktok.com/v2/auth/authorize/",
  );
  url.search = new URLSearchParams({
    response_type: "code",
    state,
    redirect_uri: callback,
    ...(provider === "meta"
      ? {
          client_id: process.env.META_APP_ID!,
          scope:
            "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish",
          auth_type: "rerequest",
        }
      : provider === "instagram"
        ? {
            client_id: process.env.INSTAGRAM_APP_ID!,
            scope: "instagram_business_basic,instagram_business_content_publish",
            enable_fb_login: "0",
            force_reauth: "true",
          }
        : {
            client_key: process.env.TIKTOK_CLIENT_KEY!,
            scope: "user.info.basic,video.upload",
          }),
  }).toString();
  return { url: url.toString(), cookie };
}
export async function consumeState(state: string, cookie: string, provider: string) {
  return transaction(async () => {
    const row = await db()
      .prepare("SELECT * FROM social_oauth WHERE state=?")
      .get(sha(state)) as State | undefined;
    if (
      !row ||
      row.consumed ||
      row.expires_at < Date.now() ||
      row.cookie_hash !== sha(cookie) ||
      JSON.parse(unseal(row.candidates!, row.state)).provider !== provider
    )
      throw new Error(
        "Connection expired. Start again from the restaurant dashboard.",
      );
    const staff = await db()
      .prepare("SELECT role FROM staff WHERE id=?")
      .get(row.staff_id) as { role: string } | undefined;
    if (!staff || !["owner", "manager"].includes(staff.role))
      throw new Error("Only an owner or manager can connect accounts.");
    await db()
      .prepare(
        "UPDATE social_oauth SET consumed=true,candidates=NULL WHERE state=?",
      )
      .run(row.state);
    return row;
  });
}
export async function finishConnection(
  state: string,
  cookie: string,
  provider: ConnectionProvider,
  code: string,
  fetcher: typeof fetch = fetch,
) {
  const row = await consumeState(state, cookie, provider);
  const callback = `${publicSite()}/api/social/callback/${provider}`;
  const candidates: Candidate[] = [];
  if (provider === "instagram") {
    let short: any;
    try {
      const response = await fetcher(
        "https://api.instagram.com/oauth/access_token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.INSTAGRAM_APP_ID!,
            client_secret: process.env.INSTAGRAM_APP_SECRET!,
            grant_type: "authorization_code",
            redirect_uri: callback,
            code,
          }),
          signal: AbortSignal.timeout(25000),
          cache: "no-store",
        },
      );
      short = await response.json();
      if (Array.isArray(short.data) && short.data.length === 1)
        short = short.data[0];
      if (!response.ok || !short.access_token || !short.user_id) throw new Error();
    } catch {
      throw new Error("Instagram authorization failed. Check the app setup and callback URL, then reconnect.");
    }
    let token: any;
    try {
      const url = new URL("https://graph.instagram.com/access_token");
      url.search = new URLSearchParams({
        grant_type: "ig_exchange_token",
        client_secret: process.env.INSTAGRAM_APP_SECRET!,
        access_token: short.access_token,
      }).toString();
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(25000),
        cache: "no-store",
      });
      token = await response.json();
      if (!response.ok || !token.access_token) throw new Error();
    } catch {
      throw new Error("Instagram could not issue a long-lived publishing token. Reconnect and try again.");
    }
    const profile = await instagramGraph(
      "me",
      token.access_token,
      { fields: "user_id,username" },
      "GET",
      false,
      fetcher,
    );
    if (!profile.user_id || String(profile.user_id) !== String(short.user_id))
      throw new Error("Instagram returned an unexpected account. Reconnect the intended NVO account.");
    candidates.push({
      id: randomUUID(), platform: "instagram", remote_id: String(profile.user_id),
      name: `@${profile.username || profile.user_id}`,
      token: JSON.stringify({ mode: "instagram_login", access_token: token.access_token }),
      expires_at: Number.isFinite(token.expires_in) ? Date.now() + token.expires_in * 1000 : null,
    });
  } else if (provider === "meta") {
    const short = await graph(
      "oauth/access_token",
      "",
      {
        client_id: process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        redirect_uri: callback,
        code,
      },
      "GET",
      false,
      fetcher,
    );
    const long = await graph(
      "oauth/access_token",
      "",
      {
        grant_type: "fb_exchange_token",
        client_id: process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        fb_exchange_token: short.access_token,
      },
      "GET",
      false,
      fetcher,
    );
    if (!long.access_token)
      throw new Error("Meta did not grant account access.");
    let after = "";
    for (let page = 0; page < 10; page++) {
      const list = await graph(
        "me/accounts",
        long.access_token,
        {
          fields:
            "id,name,access_token,tasks,instagram_business_account{id,username}",
          limit: "100",
          ...(after ? { after } : {}),
        },
        "GET",
        false,
        fetcher,
      );
      for (const p of list.data || []) {
        if (!p.access_token) continue;
        const expires_at = Number.isFinite(long.expires_in)
          ? Date.now() + long.expires_in * 1000
          : null;
        if (
          (p.tasks || []).some((v: string) =>
            [
              "CREATE_CONTENT",
              "MANAGE",
              "PROFILE_PLUS_CREATE_CONTENT",
              "PROFILE_PLUS_FULL_CONTROL",
            ].includes(v),
          )
        )
          candidates.push({
            id: randomUUID(),
            platform: "facebook",
            remote_id: p.id,
            name: p.name,
            token: p.access_token,
            expires_at,
          });
        if (p.instagram_business_account)
          candidates.push({
            id: randomUUID(),
            platform: "instagram",
            remote_id: p.instagram_business_account.id,
            name: `@${p.instagram_business_account.username || p.name}`,
            token: p.access_token,
            expires_at,
          });
      }
      if (!list.paging?.next || !list.paging?.cursors?.after) break;
      after = list.paging.cursors.after;
    }
  } else {
    const token = await tiktokToken(
      { grant_type: "authorization_code", code, redirect_uri: callback },
      fetcher,
    );
    if (!String(token.scope).split(",").includes("video.upload"))
      throw new Error("Allow TikTok uploads when connecting your account.");
    const info = await tiktok(
      "user/info/?fields=open_id,display_name",
      token.access_token,
      undefined,
      false,
      fetcher,
    );
    candidates.push({
      id: randomUUID(),
      platform: "tiktok",
      remote_id: token.open_id,
      name: info.user.display_name,
      token: JSON.stringify(token),
      expires_at: Date.now() + token.expires_in * 1000,
    });
  }
  if (!candidates.length)
    throw new Error(
      provider === "instagram"
        ? "No eligible Instagram account was returned. Authorize an Instagram Business or Creator account with publishing access."
        : "No eligible accounts found. Connect a Facebook Page with publishing access and a linked Instagram professional account.",
    );
  await db()
    .prepare("UPDATE social_oauth SET candidates=?,expires_at=? WHERE state=?")
    .run(
      seal(JSON.stringify(candidates), row.state),
      Date.now() + 600000,
      row.state,
    );
}
export async function pendingAccounts(staffId: string) {
  const row = await db()
    .prepare(
      "SELECT * FROM social_oauth WHERE staff_id=? AND consumed=true AND candidates IS NOT NULL AND expires_at>?",
    )
    .get(staffId, Date.now()) as State | undefined;
  if (!row) return [];
  return (JSON.parse(unseal(row.candidates!, row.state)) as Candidate[]).map(
    ({ id, platform, remote_id, name }) => ({ id, platform, remote_id, name }),
  );
}
export async function selectAccounts(
  staffId: string,
  ids: string[],
  automatic: boolean,
) {
  return transaction(async () => {
    const row = await db()
      .prepare(
        "SELECT * FROM social_oauth WHERE staff_id=? AND consumed=true AND candidates IS NOT NULL AND expires_at>?",
      )
      .get(staffId, Date.now()) as State | undefined;
    if (!row) throw new Error("Account selection expired. Connect again.");
    const candidates = JSON.parse(
      unseal(row.candidates!, row.state),
    ) as Candidate[];
    if (!ids.length || ids.some((id) => !candidates.some((c) => c.id === id)))
      throw new Error("Choose at least one account from the connection list.");
    for (const c of candidates.filter((c) => ids.includes(c.id))) {
      const old = await db()
        .prepare(
          "SELECT id FROM social_accounts WHERE platform=? AND remote_id=?",
        )
        .get(c.platform, c.remote_id) as { id: string } | undefined;
      const id = old?.id || c.id,
        now = new Date().toISOString();
      await db()
        .prepare(
          "INSERT INTO social_accounts VALUES(?,?,?,?,?,?,'connected',?,?,?) ON CONFLICT(platform,remote_id) DO UPDATE SET name=excluded.name,token=excluded.token,expires_at=excluded.expires_at,status='connected',auto_publish=excluded.auto_publish,updated_at=excluded.updated_at",
        )
        .run(
          id,
          c.platform,
          c.remote_id,
          c.name,
          seal(c.token, id),
          c.expires_at,
          automatic && c.platform !== "tiktok",
          now,
          now,
        );
    }
    await db().prepare("DELETE FROM social_oauth WHERE state=?").run(row.state);
  });
}
