import { createHmac } from "node:crypto";
import { db } from "../db";
import { metaVersion, seal, unseal } from "./security";
import type { Account } from "./types";
export class ProviderError extends Error {
  constructor(
    message: string,
    public kind: "auth" | "retry" | "failed" | "uncertain",
  ) {
    super(message);
  }
}
// Provider bodies can echo credentials; only sanitized errors reach staff or logs.
export async function graph(
  endpoint: string,
  token: string,
  params: Record<string, string> = {},
  method = "GET",
  final = false,
  fetcher: typeof fetch = fetch,
): Promise<any> {
  return graphAt("https://graph.facebook.com", endpoint, token, params, method, final, fetcher, true);
}
export async function instagramGraph(
  endpoint: string,
  token: string,
  params: Record<string, string> = {},
  method = "GET",
  final = false,
  fetcher: typeof fetch = fetch,
): Promise<any> {
  return graphAt("https://graph.instagram.com", endpoint, token, params, method, final, fetcher, false);
}
export function accountInstagramGraph(a: Account) {
  let directLogin = false;
  try {
    directLogin = JSON.parse(unseal(a.token, a.id)).mode === "instagram_login";
  } catch { /* Existing Facebook Login accounts use the Facebook Graph host. */ }
  return directLogin ? instagramGraph : graph;
}
async function graphAt(
  host: string,
  endpoint: string,
  token: string,
  params: Record<string, string>,
  method: string,
  final: boolean,
  fetcher: typeof fetch,
  withProof: boolean,
): Promise<any> {
  const values = new URLSearchParams(params);
  if (withProof && token && process.env.META_APP_SECRET)
    values.set(
      "appsecret_proof",
      createHmac("sha256", process.env.META_APP_SECRET)
        .update(token)
        .digest("hex"),
    );
  const url = `${host}/${metaVersion()}/${endpoint}`;
  let r: Response;
  try {
    r = await fetcher(method === "GET" ? `${url}?${values}` : url, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: method === "GET" ? undefined : values,
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    });
  } catch {
    throw new ProviderError(
      final
        ? "The platform did not confirm the result. Check the account before retrying."
        : "The platform did not respond. We will retry.",
      final ? "uncertain" : "retry",
    );
  }
  let b: any;
  try {
    b = await r.json();
  } catch {
    throw new ProviderError(
      "The platform returned an unreadable response.",
      final ? "uncertain" : "retry",
    );
  }
  if (b.error || !r.ok) {
    const code = Number(b.error?.code);
    if ([102, 190, 10, 200].includes(code) || r.status === 401)
      throw new ProviderError(
        "Reconnect this account and grant publishing permission.",
        "auth",
      );
    if (r.status >= 500 && final)
      throw new ProviderError(
        "The platform did not confirm whether it posted. Check before retrying.",
        "uncertain",
      );
    if (
      r.status === 429 ||
      r.status >= 500 ||
      [1, 2, 4, 17, 32, 613].includes(code) ||
      b.error?.is_transient
    )
      throw new ProviderError(
        "The platform is busy or has reached its posting limit. We will retry.",
        "retry",
      );
    throw new ProviderError(
      `The platform rejected this post (code ${Number.isFinite(code) ? code : r.status}). Check the photo and account permissions.`,
      "failed",
    );
  }
  return b;
}
export async function tiktok(
  path: string,
  token: string,
  body?: unknown,
  final = false,
  fetcher: typeof fetch = fetch,
): Promise<any> {
  let r: Response;
  try {
    r = await fetcher(`https://open.tiktokapis.com/v2/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    });
  } catch {
    throw new ProviderError(
      "TikTok did not confirm the request.",
      final ? "uncertain" : "retry",
    );
  }
  let b: any;
  try {
    b = await r.json();
  } catch {
    throw new ProviderError(
      "TikTok returned an unreadable response.",
      final ? "uncertain" : "retry",
    );
  }
  const code = b.error?.code;
  if (!r.ok || (code && code !== "ok")) {
    if (
      r.status === 401 ||
      ["access_token_invalid", "scope_not_authorized"].includes(code)
    )
      throw new ProviderError("Reconnect TikTok and allow uploads.", "auth");
    if (final && r.status >= 500)
      throw new ProviderError(
        "Check your TikTok inbox before retrying this upload.",
        "uncertain",
      );
    if (r.status === 429 || r.status >= 500)
      throw new ProviderError("TikTok is busy. We will retry.", "retry");
    throw new ProviderError(
      code === "url_ownership_unverified"
        ? "The owner must verify the website's media domain in TikTok app setup."
        : "TikTok rejected this upload. Check your account limits, photo and app permissions.",
      "failed",
    );
  }
  return b.data;
}
export async function tiktokToken(
  params: Record<string, string>,
  fetcher: typeof fetch = fetch,
) {
  let r: Response;
  try {
    r = await fetcher("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY || "",
        client_secret: process.env.TIKTOK_CLIENT_SECRET || "",
        ...params,
      }),
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new ProviderError(
      "TikTok authorization did not respond. Reconnect and try again.",
      "auth",
    );
  }
  const b = await r.json();
  if (
    !r.ok ||
    b.error ||
    !b.access_token ||
    !b.refresh_token ||
    !b.open_id ||
    !Number.isFinite(b.expires_in)
  )
    throw new ProviderError(
      "TikTok authorization expired or was declined. Reconnect the account.",
      "auth",
    );
  return b;
}
export async function accountToken(a: Account, fetcher: typeof fetch = fetch) {
  let token: string;
  try {
    token = unseal(a.token, a.id);
  } catch {
    throw new ProviderError(
      "Reconnect this account before publishing.",
      "auth",
    );
  }
  if (a.platform === "instagram") {
    let data: { mode?: string; access_token: string };
    try {
      data = JSON.parse(token);
    } catch {
      // Tokens created through the older Facebook Login flow were stored raw.
      data = { access_token: token };
    }
    if (data.mode !== "instagram_login") {
      if (a.expires_at && a.expires_at < Date.now() + 60000)
        throw new ProviderError("This account's authorization has expired. Reconnect it.", "auth");
      return data.access_token;
    }
    if (a.expires_at && a.expires_at < Date.now() + 7 * 86400000) {
      let refreshed: any;
      try {
        const url = new URL("https://graph.instagram.com/refresh_access_token");
        url.search = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: data.access_token }).toString();
        const response = await fetcher(url, { signal: AbortSignal.timeout(25000), cache: "no-store" });
        refreshed = await response.json();
        if (!response.ok || !refreshed.access_token || !Number.isFinite(refreshed.expires_in)) throw new Error();
      } catch {
        throw new ProviderError("Reconnect this Instagram account to renew publishing access.", "auth");
      }
      data = { mode: "instagram_login", access_token: refreshed.access_token };
      const expires = Date.now() + refreshed.expires_in * 1000;
      await db().prepare("UPDATE social_accounts SET token=?,expires_at=?,updated_at=? WHERE id=? AND status='connected'")
        .run(seal(JSON.stringify(data), a.id), expires, new Date().toISOString(), a.id);
      return data.access_token;
    }
    return data.access_token;
  }
  if (a.platform !== "tiktok") {
    if (a.expires_at && a.expires_at < Date.now() + 60000)
      throw new ProviderError(
        "This account's authorization has expired. Reconnect it.",
        "auth",
      );
    return token;
  }
  const data = JSON.parse(token);
  if (a.expires_at && a.expires_at > Date.now() + 120000)
    return data.access_token;
  const refreshed = await tiktokToken(
    { grant_type: "refresh_token", refresh_token: data.refresh_token },
    fetcher,
  );
  if (refreshed.open_id !== a.remote_id)
    throw new ProviderError(
      "TikTok account identity changed. Reconnect it.",
      "auth",
    );
  await db()
    .prepare(
      "UPDATE social_accounts SET token=?,expires_at=?,updated_at=? WHERE id=? AND status='connected'",
    )
    .run(
      seal(JSON.stringify(refreshed), a.id),
      Date.now() + refreshed.expires_in * 1000,
      new Date().toISOString(),
      a.id,
    );
  return refreshed.access_token as string;
}
