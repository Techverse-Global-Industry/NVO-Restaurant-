"use client";
import { useEffect, useRef, useState } from "react";
import {
  Facebook,
  Instagram,
  MessageCircle,
  Music2,
  Radio,
  Plus,
  RefreshCw,
  Check,
  ArrowUpRight,
  Link2,
  Unplug,
  Sparkles,
  Clock3,
} from "lucide-react";
import type { Entry } from "@/lib/types";
import {
  captionLimits,
  defaultPlan,
  platformNames,
  type Platform,
  type PublicAccount,
  type SocialPlan,
  type JobStatus,
} from "@/lib/social/types";
import { api } from "./provider";
const icons = {
  facebook: Facebook,
  instagram: Instagram,
  tiktok: Music2,
  whatsapp: MessageCircle,
};
const labels: Record<JobStatus, string> = {
  queued: "Scheduled",
  preparing: "Preparing",
  retry: "Waiting to retry",
  publishing: "Sending",
  published: "Published",
  failed: "Needs attention",
  needs_review: "Check the destination",
  needs_auth: "Reconnect account",
  cancelled: "Cancelled",
  processing: "TikTok is processing",
  inbox: "Finish in TikTok",
  ready: "Ready",
};
type Delivery = { status: string; count: number };
type SocialJob = {
  id: string;
  entry_id: string;
  account_id: string;
  platform: Platform;
  name: string;
  title: string;
  image: string;
  caption: string;
  status: JobStatus;
  attempts: number;
  next_attempt: number;
  last_error: string | null;
  permalink: string | null;
  provider_id: string | null;
  created_at: string;
  deliveries: Delivery[];
};
type Readiness = { ready: boolean; reasons: string[] };
type Dashboard = {
  accounts: PublicAccount[];
  pending: {
    id: string;
    platform: Platform;
    remote_id: string;
    name: string;
  }[];
  jobs: SocialJob[];
  meta: Readiness;
  tiktok: Readiness;
  whatsapp: Readiness;
  whatsappTemplates: string[];
  ai: boolean;
  manage: boolean;
  worker: { running: boolean; mode: string };
  subscribers: number;
};
async function get<T>(path: string): Promise<T> {
  const r = await fetch(`/api/admin/social/${path}`, { cache: "no-store" });
  const b = await r.json();
  if (!r.ok) throw new Error(b.error || "Unable to load publishing.");
  return b;
}
const displayTime = (t: number | string) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Porto-Novo",
  }).format(new Date(t));
function PlatformIcon({ platform }: { platform: Platform }) {
  const Icon = icons[platform];
  return (
    <span className={`social-symbol ${platform}`}>
      <Icon size={21} />
    </span>
  );
}
export function SocialStudio({
  posts,
  edit,
  create,
}: {
  posts: Entry[];
  edit: (e: Entry) => void;
  create: () => void;
}) {
  const [data, setData] = useState<Dashboard | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [chosen, setChosen] = useState<string[]>([]),
    [automatic, setAutomatic] = useState(true),
    [filter, setFilter] = useState("all"),
    [review, setReview] = useState(""),
    [checked, setChecked] = useState(false),
    [disconnect, setDisconnect] = useState("");
  const [audience, setAudience] = useState<
      | { phone: string; name: string; status: string; consented_at: string }[]
      | null
    >(null),
    [details, setDetails] = useState<
      | {
          recipient: string;
          status: string;
          attempts: number;
          last_error: string | null;
        }[]
      | null
    >(null);
  const load = async () => setData(await get<Dashboard>("dashboard"));
  useEffect(() => {
    let active = true;
    const refresh = () =>
      get<Dashboard>("dashboard")
        .then((d) => {
          if (active) setData(d);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 10000);
    if (new URLSearchParams(location.search).get("social") === "error")
      setError(
        "The account connection was not completed. Check app setup and permissions, then try again.",
      );
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  async function act(action: string, body: unknown, message = "Updated.") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api(`admin/social/${action}`, body);
      if (result.url) {
        location.assign(result.url);
        return;
      }
      await load();
      setNotice(message);
      setReview("");
      setDisconnect("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <div className="admin-panel">
        <p role="status">Opening your publishing desk…</p>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  const attention = data.jobs.filter((j) =>
    ["failed", "needs_review", "needs_auth"].includes(j.status),
  ).length;
  return (
    <div className="social-studio">
      <div className="social-hero">
        <div>
          <span className="eyebrow">ONE STORY. MORE GUESTS.</span>
          <h2>Make NVO the next craving.</h2>
          <p>
            Write your story once. Choose where it goes. Give every audience a
            caption that belongs there.
          </p>
          <div className="button-row">
            <button className="button gold" onClick={create}>
              <Plus size={18} />
              Create a post
            </button>
            <a className="social-quiet-link" href="#delivery-log">
              View delivery history <ArrowUpRight size={16} />
            </a>
          </div>
        </div>
        <div className="social-orbit" aria-hidden="true">
          <span>NVO</span>
          {(["facebook", "instagram", "tiktok", "whatsapp"] as Platform[]).map(
            (p) => (
              <PlatformIcon key={p} platform={p} />
            ),
          )}
        </div>
      </div>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success-message" role="status">
          {notice}
        </p>
      )}
      <div className="social-metrics">
        <div>
          <b>{data.accounts.filter((a) => a.status === "connected").length}</b>
          <span>Connected destinations</span>
        </div>
        <div>
          <b>
            {
              data.jobs.filter((j) =>
                [
                  "queued",
                  "retry",
                  "preparing",
                  "publishing",
                  "processing",
                ].includes(j.status),
              ).length
            }
          </b>
          <span>On their way</span>
        </div>
        <div>
          <b>{data.subscribers}</b>
          <span>WhatsApp subscribers</span>
        </div>
        <div>
          <b>{attention}</b>
          <span>Need attention</span>
        </div>
      </div>
      {!!data.pending.length && (
        <section className="admin-panel form">
          <h3>Choose the accounts NVO can use</h3>
          <p>Only the accounts you select will be connected.</p>
          {data.pending.map((a) => (
            <label className="checkbox" key={a.id}>
              <input
                type="checkbox"
                checked={chosen.includes(a.id)}
                onChange={(e) =>
                  setChosen(
                    e.target.checked
                      ? [...chosen, a.id]
                      : chosen.filter((id) => id !== a.id),
                  )
                }
              />
              <PlatformIcon platform={a.platform} />
              {a.name} · {platformNames[a.platform]}
            </label>
          ))}
          <label className="checkbox">
            <input
              type="checkbox"
              checked={automatic}
              onChange={(e) => setAutomatic(e.target.checked)}
            />
            Automatically share future genuine website posts to the selected
            Facebook and Instagram accounts. TikTok is chosen per post.
          </label>
          <button
            className="button"
            disabled={busy || !chosen.length}
            onClick={() =>
              void act(
                "select",
                { ids: chosen, automatic },
                "Accounts connected. Existing posts have not been sent.",
              )
            }
          >
            <Check size={16} />
            Connect selected accounts
          </button>
        </section>
      )}
      <section>
        <div className="social-section-title">
          <div>
            <span className="eyebrow">YOUR DESTINATIONS</span>
            <h3>Every channel, your choice.</h3>
          </div>
          <span className="status-pill">Website connected</span>
        </div>
        <div className="social-account-grid">
          {(["facebook", "instagram", "tiktok", "whatsapp"] as Platform[]).map(
            (p) => {
              const list = data.accounts.filter(
                (a) => a.platform === p && a.status !== "disconnected",
              );
              const setup =
                p === "facebook" || p === "instagram"
                  ? data.meta
                  : p === "tiktok"
                    ? data.tiktok
                    : data.whatsapp;
              return (
                <article className="social-account" key={p}>
                  <div className="social-account-heading">
                    <PlatformIcon platform={p} />
                    <h3>{platformNames[p]}</h3>
                  </div>
                  <p>
                    {p === "facebook"
                      ? "Photo stories with a useful caption and a link back to NVO."
                      : p === "instagram"
                        ? "Appetising photo posts, a shorter caption and focused hashtags."
                        : p === "tiktok"
                          ? "Send a photo post to the account’s TikTok inbox. Finish posting in TikTok."
                          : "Photo updates sent to subscribed customers through an approved marketing template."}
                  </p>
                  {list.map((a) => (
                    <div className="social-connected" key={a.id}>
                      <strong>{a.name}</strong>
                      <span className={`social-state ${a.status}`}>
                        {a.status === "connected"
                          ? "Connected"
                          : "Reconnect to continue"}
                      </span>
                      {p !== "tiktok" && (
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={a.auto_publish === 1}
                            disabled={busy || !data.manage}
                            onChange={(e) =>
                              void act(
                                "account",
                                {
                                  id: a.id,
                                  action: "automatic",
                                  enabled: e.target.checked,
                                },
                                "Default updated. You can override it on every post.",
                              )
                            }
                          />
                          Use by default for new posts
                        </label>
                      )}
                      {data.manage && (
                        <button
                          className="social-text-button"
                          onClick={() => setDisconnect(a.id)}
                        >
                          <Unplug size={14} />
                          Disconnect
                        </button>
                      )}
                      {disconnect === a.id && (
                        <div className="social-confirm">
                          <p>
                            Stop future deliveries to this account? Posts
                            already sent remain on the platform.
                          </p>
                          <button
                            className="button outline"
                            disabled={busy}
                            onClick={() =>
                              void act(
                                "account",
                                { id: a.id, action: "disconnect" },
                                "Disconnected. Queued deliveries have been stopped.",
                              )
                            }
                          >
                            Disconnect account
                          </button>
                          <button onClick={() => setDisconnect("")}>
                            Keep connected
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {!list.length && (
                    <span className="social-state">Not connected</span>
                  )}
                  {data.manage && (
                    <button
                      className="button outline"
                      disabled={busy || !setup.ready}
                      onClick={() =>
                        void act(
                          "connect",
                          {
                            provider:
                              p === "facebook" || p === "instagram"
                                ? "meta"
                                : p,
                          },
                          "WhatsApp connected. Choose its default below.",
                        )
                      }
                    >
                      <Link2 size={16} />
                      {list.length ? "Connect / reconnect" : "Connect account"}
                    </button>
                  )}
                  {!setup.ready && (
                    <details className="social-setup">
                      <summary>Account setup needed</summary>
                      <p>
                        The owner’s server setup is required before
                        authorization.
                      </p>
                      <ul>
                        {setup.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </article>
              );
            },
          )}
        </div>
      </section>
      <div className="social-help-row">
        <div className="admin-panel">
          <Sparkles size={22} />
          <h3>Your words. Made for each platform.</h3>
          <p>
            Captions are written automatically for each platform, using the
            facts in your post. No paid AI service is required.
          </p>
        </div>
        <div className="admin-panel">
          <Clock3 size={22} />
          <h3>Post now, or plan ahead.</h3>
          <p>
            Use the post’s start date to schedule its first delivery. Changing a
            published story does not repost it. Create a new story for a new
            announcement.
          </p>
          <span
            className={`social-state ${data.worker.running ? "connected" : ""}`}
          >
            {data.worker.running
              ? "Delivery worker is running"
              : "Delivery worker has no recent heartbeat"}
          </span>
        </div>
      </div>
      <section className="admin-panel" id="delivery-log">
        <div className="social-section-title">
          <div>
            <span className="eyebrow">REAL DELIVERY RESULTS</span>
            <h3>Follow every post.</h3>
          </div>
          <label className="social-filter">
            Show
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Every destination</option>
              {Object.entries(platformNames).map(([p, n]) => (
                <option value={p} key={p}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!data.jobs.length ? (
          <div className="social-empty">
            <Radio size={30} />
            <h3>Your next story starts here.</h3>
            <p>
              Connect an account, then create a post with a photo. Drafts and
              sample content stay on the website.
            </p>
            <button className="button outline" onClick={create}>
              Create your first post
            </button>
          </div>
        ) : (
          <div className="social-job-list">
            {data.jobs
              .filter((j) => filter === "all" || j.platform === filter)
              .map((j) => (
                <article className="social-job" key={j.id}>
                  <div className="social-job-top">
                    <PlatformIcon platform={j.platform} />
                    <div>
                      <h4>{j.title}</h4>
                      <p>
                        {j.name} · {displayTime(j.created_at)} (Cotonou)
                      </p>
                    </div>
                    <span className={`social-state ${j.status}`}>
                      {j.platform === "whatsapp" && j.status === "published"
                        ? "Messages sent"
                        : labels[j.status]}
                    </span>
                  </div>
                  {j.last_error && (
                    <p className="social-job-error">{j.last_error}</p>
                  )}
                  {["queued", "retry"].includes(j.status) && (
                    <p className="form-note">
                      Next attempt: {displayTime(j.next_attempt)} · Cotonou time
                    </p>
                  )}
                  {j.platform === "whatsapp" && !!j.deliveries.length && (
                    <p className="social-delivery-counts">
                      {j.deliveries
                        .map(
                          (d) => `${d.count} ${d.status.replaceAll("_", " ")}`,
                        )
                        .join(" · ")}
                    </p>
                  )}
                  {j.status === "inbox" && (
                    <p>
                      Open this account’s TikTok inbox to finish editing and
                      publish. Your post is not public yet.
                    </p>
                  )}
                  <details>
                    <summary>See caption & actions</summary>
                    <div className="social-job-preview">
                      {j.image && (
                        <img src={j.image} alt="Post photo" loading="lazy" />
                      )}
                      <p>
                        {j.caption ||
                          "The caption will be prepared when delivery begins."}
                      </p>
                    </div>
                    <div className="button-row">
                      {posts.some((p) => p.id === j.entry_id) && (
                        <button
                          className="button outline"
                          onClick={() =>
                            edit(posts.find((p) => p.id === j.entry_id)!)
                          }
                        >
                          Edit website post
                        </button>
                      )}
                      {j.permalink && (
                        <a
                          className="button outline"
                          href={j.permalink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View on {platformNames[j.platform]}{" "}
                          <ArrowUpRight size={15} />
                        </a>
                      )}
                      {["failed", "needs_auth", "cancelled"].includes(
                        j.status,
                      ) && (
                        <button
                          className="button outline"
                          disabled={busy}
                          onClick={() =>
                            void act(
                              "job",
                              { id: j.id, action: "retry" },
                              "Delivery queued again.",
                            )
                          }
                        >
                          <RefreshCw size={15} />
                          Retry delivery
                        </button>
                      )}
                      {j.status === "needs_review" && (
                        <button
                          className="button outline"
                          onClick={() => {
                            setReview(j.id);
                            setChecked(false);
                          }}
                        >
                          Check & retry
                        </button>
                      )}
                      {[
                        "queued",
                        "retry",
                        "preparing",
                        "failed",
                        "needs_auth",
                      ].includes(j.status) && (
                        <button
                          className="social-text-button"
                          disabled={busy}
                          onClick={() =>
                            void act(
                              "job",
                              { id: j.id, action: "cancel" },
                              "This delivery was cancelled.",
                            )
                          }
                        >
                          Cancel this delivery
                        </button>
                      )}
                      {j.platform === "whatsapp" && (
                        <button
                          className="social-text-button"
                          onClick={() =>
                            void get<{
                              deliveries: NonNullable<typeof details>;
                            }>(`deliveries?id=${encodeURIComponent(j.id)}`)
                              .then((r) => setDetails(r.deliveries))
                              .catch((e) => setError(e.message))
                          }
                        >
                          Recipient results
                        </button>
                      )}
                    </div>
                    {review === j.id && (
                      <div className="social-confirm">
                        <p>
                          The platform did not confirm its result. Retrying
                          could create a duplicate.
                        </p>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setChecked(e.target.checked)}
                          />
                          I checked the destination and confirmed the
                          unconfirmed post/messages were not sent.
                        </label>
                        <button
                          className="button"
                          disabled={!checked || busy}
                          onClick={() =>
                            void act(
                              "job",
                              { id: j.id, action: "retry", checked: true },
                              "Checked delivery queued again.",
                            )
                          }
                        >
                          Retry checked delivery
                        </button>
                      </div>
                    )}
                  </details>
                </article>
              ))}
          </div>
        )}
      </section>
      {details && (
        <section className="admin-panel">
          <h3>WhatsApp recipient results</h3>
          <button
            className="social-text-button"
            onClick={() => setDetails(null)}
          >
            Close results
          </button>
          {details.map((d, i) => (
            <p key={i}>
              {d.recipient} · {d.status.replaceAll("_", " ")} ·{" "}
              {d.last_error || `${d.attempts} attempt(s)`}
            </p>
          ))}
        </section>
      )}
      {data.manage && (
        <section className="admin-panel">
          <div className="social-section-title">
            <div>
              <h3>A community that wants to hear from NVO.</h3>
              <p>
                Customers subscribe themselves. A STOP message removes them from
                future sends. WhatsApp marketing messages may incur Meta
                charges.
              </p>
            </div>
            <button
              className="button outline"
              onClick={() =>
                void get<{ subscribers: NonNullable<typeof audience> }>(
                  "audience",
                )
                  .then((r) => setAudience(r.subscribers))
                  .catch((e) => setError(e.message))
              }
            >
              Manage subscribers
            </button>
          </div>
          <a href="/subscribe" target="_blank" rel="noreferrer">
            Open customer subscription page <ArrowUpRight size={14} />
          </a>
          {audience && (
            <div className="social-audience">
              {!audience.length && (
                <p>
                  No subscribers yet. Share the subscription page with your
                  guests.
                </p>
              )}
              {audience.map((s) => (
                <div key={s.phone}>
                  <span>
                    <strong>{s.name || "NVO guest"}</strong>
                    <br />+{s.phone} · {s.status}
                  </span>
                  {s.status === "subscribed" && (
                    <button
                      disabled={busy}
                      className="social-text-button"
                      onClick={() =>
                        void act(
                          "unsubscribe",
                          { phone: s.phone },
                          "Customer unsubscribed.",
                        )
                          .then(() =>
                            get<{ subscribers: NonNullable<typeof audience> }>(
                              "audience",
                            ),
                          )
                          .then((r) => setAudience(r.subscribers))
                      }
                    >
                      Unsubscribe
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function SocialOptions({
  entry,
  onChange,
  onReady,
  contentReady = true,
}: {
  entry: Entry;
  onChange: (p: SocialPlan) => void;
  onReady: (ready: boolean) => void;
  contentReady?: boolean;
}) {
  const [data, setData] = useState<Dashboard | null>(null),
    [plan, setPlan] = useState<SocialPlan>({ ...defaultPlan }),
    [tab, setTab] = useState<Platform>("facebook"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [changed, setChanged] = useState(false);
  const [manual, setManual] = useState(false);
  const signature = JSON.stringify([
    entry.title,
    entry.titleFr,
    entry.description,
    entry.descriptionFr,
    entry.image,
    entry.startsAt,
    entry.endsAt,
    entry.date,
    entry.location,
  ]);
  const previous = useRef(signature);
  useEffect(() => {
    let active = true;
    void Promise.all([
      get<Dashboard>("dashboard"),
      get<{ plan: SocialPlan }>(`plan?id=${encodeURIComponent(entry.id)}`),
    ])
      .then(([d, p]) => {
        if (active) {
          setData(d);
          setPlan({ ...p.plan, tiktokConsent: false });
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [entry.id]);
  useEffect(() => {
    if (previous.current !== signature) {
      previous.current = signature;
      setPlan((p) => ({
        ...p,
        captions: {},
        captionSource: "standard",
        tiktokConsent: false,
      }));
      setChanged(true);
    }
  }, [signature]);
  const selected = (data?.accounts || []).filter(
    (a) =>
      a.status !== "disconnected" &&
      (plan.mode === "selected"
        ? plan.accounts.includes(a.id)
        : plan.mode === "auto" && a.auto_publish === 1),
  );
  const requiresTikTok =
    selected.some((a) => a.platform === "tiktok") &&
    entry.active &&
    entry.status !== "draft" &&
    !entry.demo;
  useEffect(() => {
    onChange(plan);
    onReady(
      !!data &&
        !busy &&
        (!requiresTikTok || (!!plan.tiktokConsent && !!plan.captions.tiktok)),
    );
  }, [plan, data, busy, requiresTikTok, onChange, onReady]);
  function update(p: Partial<SocialPlan>) {
    setPlan((old) => ({ ...old, ...p }));
  }
  useEffect(() => {
    if (!data || manual || !entry.title.trim()) return;
    let active = true;
    setBusy(true);
    setChanged(true);
    const timer = setTimeout(async () => {
      try {
        const result = await api("admin/social/captions", {
          entry,
          language: plan.language,
          ai: false,
        });
        if (active) {
          setPlan((old) => ({
            ...old,
            captions: result.captions,
            captionSource: "standard",
            tiktokConsent: false,
          }));
          setChanged(false);
          setError("");
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setBusy(false);
      }
    }, 650);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [signature, plan.language, !!data, manual]);
  return (
    <fieldset className="social-options">
      <legend>
        <Radio size={18} />
        Share this story
      </legend>
      <p>
        Choose where this post goes. Website drafts and sample content never
        leave the website.
      </p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <p role="status">Loading your destinations…</p>
      ) : (
        <>
          <div className="form-row">
            <label>
              Destinations
              <select
                aria-label="Destinations"
                value={plan.mode}
                onChange={(e) =>
                  update({
                    mode: e.target.value as SocialPlan["mode"],
                    tiktokConsent: false,
                  })
                }
              >
                <option value="auto">Use the restaurant’s defaults</option>
                <option value="selected">Choose for this post</option>
                <option value="off">Website only</option>
              </select>
            </label>
            <label>
              Caption language
              <select
                aria-label="Caption language"
                value={plan.language}
                onChange={(e) =>
                  update({
                    language: e.target.value as "en" | "fr",
                    captions: {},
                    captionSource: "standard",
                    tiktokConsent: false,
                  })
                }
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
          {plan.mode !== "off" && (
            <>
              <div className="social-choose-grid">
                {data.accounts
                  .filter((a) => a.status !== "disconnected")
                  .map((a) => (
                    <label
                      className={`social-choice ${selected.some((s) => s.id === a.id) ? "selected" : ""}`}
                      key={a.id}
                    >
                      <input
                        type="checkbox"
                        checked={selected.some((s) => s.id === a.id)}
                        onChange={(e) =>
                          update({
                            mode: "selected",
                            accounts: e.target.checked
                              ? [...selected.map((s) => s.id), a.id]
                              : selected
                                  .filter((s) => s.id !== a.id)
                                  .map((s) => s.id),
                            tiktokConsent: false,
                          })
                        }
                      />
                      <PlatformIcon platform={a.platform} />
                      <span>
                        <strong>{platformNames[a.platform]}</strong>
                        <small>{a.name}</small>
                        <small>
                          {a.platform === "tiktok"
                            ? "Finish in TikTok"
                            : a.platform === "whatsapp"
                              ? `${data.subscribers} subscribers`
                              : "Automatic publishing"}
                        </small>
                      </span>
                    </label>
                  ))}
              </div>
              {!data.accounts.some((a) => a.status !== "disconnected") && (
                <p className="form-note">
                  No social accounts connected yet. Captions are generated
                  automatically; the post will appear on the website only.
                </p>
              )}
              {selected.some((a) => a.platform === "whatsapp") && (
                <p className="form-note">
                  WhatsApp sends to subscribed customers using your approved{" "}
                  {plan.language.toUpperCase()} template. Meta messaging charges
                  may apply.
                  {!data.whatsappTemplates.includes(plan.language) &&
                    " Connect a template in this language before sending."}
                </p>
              )}
              <div className="auto-caption-note" role="status">
                <Sparkles size={22} />
                <div>
                  <strong>
                    {busy || changed
                      ? "Preparing your four captions..."
                      : "Four platforms. Four ready-to-use captions."}
                  </strong>
                  <p>
                    Captions update automatically from your post. No caption
                    writing, AI account or paid API is needed.
                  </p>
                </div>
              </div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={manual}
                  onChange={(e) => {
                    setManual(e.target.checked);
                    if (e.target.checked) {
                      setBusy(false);
                      setChanged(false);
                    }
                  }}
                />
                Edit captions myself for this post (optional)
              </label>
              <div
                className="social-caption-tabs"
                role="tablist"
                aria-label="Platform captions"
              >
                {(Object.keys(platformNames) as Platform[]).map((p) => (
                  <button
                    type="button"
                    role="tab"
                    tabIndex={tab === p ? 0 : -1}
                    aria-selected={tab === p}
                    aria-controls={tab === p ? `caption-${p}` : undefined}
                    id={`tab-${p}`}
                    key={p}
                    onClick={() => setTab(p)}
                    onKeyDown={(e) => {
                      const keys = Object.keys(platformNames) as Platform[];
                      const index = keys.indexOf(p);
                      const next =
                        e.key === "ArrowRight"
                          ? keys[(index + 1) % keys.length]
                          : e.key === "ArrowLeft"
                            ? keys[(index + keys.length - 1) % keys.length]
                            : e.key === "Home"
                              ? keys[0]
                              : e.key === "End"
                                ? keys[keys.length - 1]
                                : null;
                      if (next) {
                        e.preventDefault();
                        setTab(next);
                        document.getElementById(`tab-${next}`)?.focus();
                      }
                    }}
                  >
                    <PlatformIcon platform={p} />
                    {platformNames[p]}
                  </button>
                ))}
              </div>
              <div
                role="tabpanel"
                id={`caption-${tab}`}
                aria-labelledby={`tab-${tab}`}
              >
                <label>
                  {platformNames[tab]} caption
                  <textarea
                    aria-label={`${platformNames[tab]} caption`}
                    maxLength={captionLimits[tab]}
                    readOnly={!manual}
                    value={plan.captions[tab] || ""}
                    onChange={(e) =>
                      update({
                        captions: { ...plan.captions, [tab]: e.target.value },
                        tiktokConsent:
                          tab === "tiktok" ? false : plan.tiktokConsent,
                      })
                    }
                    placeholder="Prepare a caption above or write your own. Leaving this blank uses the platform’s standard caption when sending."
                  />
                </label>
                <span className="social-caption-count">
                  {(plan.captions[tab] || "").length} / {captionLimits[tab]}
                </span>
              </div>
              {requiresTikTok && (
                <div className="social-confirm">
                  <p>
                    TikTok receives this photo and the TikTok caption shown
                    above. Open the account’s inbox afterwards to finish
                    publishing. Use an original restaurant photo without an
                    added promotional watermark.
                  </p>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={!!plan.tiktokConsent}
                      disabled={
                        !plan.captions.tiktok ||
                        busy ||
                        changed ||
                        !contentReady
                      }
                      onChange={(e) =>
                        update({ tiktokConsent: e.target.checked })
                      }
                    />
                    I reviewed the photo and TikTok caption and want to send
                    them to{" "}
                    {selected
                      .filter((a) => a.platform === "tiktok")
                      .map((a) => a.name)
                      .join(", ")}
                    .
                  </label>
                  {(!plan.captions.tiktok ||
                    busy ||
                    changed ||
                    !contentReady) && (
                    <p className="form-note">
                      Translation and captions are updating. Review the finished
                      version before confirming TikTok.
                    </p>
                  )}
                </div>
              )}
              {selected.length > 0 && !entry.image && (
                <p className="social-job-error">
                  Choose a photo above so your social posts can be delivered.
                </p>
              )}
              <p className="form-note">
                Each account receives a post once. Edits update unsent versions;
                posts already sent remain on their platforms.
              </p>
            </>
          )}
        </>
      )}
    </fieldset>
  );
}
