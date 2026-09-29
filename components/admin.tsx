"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Tags,
  Sparkles,
  FileText,
  CalendarDays,
  Users,
  Image as ImageIcon,
  Gift,
  Settings as SettingsIcon,
  ShoppingBag,
  ArrowUpRight,
  Plus,
  X,
  LogOut,
  Radio,
  BarChart3,
  MessageSquare,
  Copy,
  Check,
  Trash2,
} from "lucide-react";
import { StaffGuide, ChefPortrait } from "./chef";
import { SocialStudio, SocialOptions } from "./social-admin";
import type { SocialPlan } from "@/lib/social/types";
import { api } from "./provider";
import { BilingualFields } from "./bilingual-fields";
import { GuestActivity } from "./guest-activity";
import type { ActivityReport } from "@/lib/analytics";
import { CouponDesk } from "./coupon-desk";
import { Brand } from "./shell";
import type { Entry, Kind, Settings, Staff } from "@/lib/types";
type RecordRow = {
  id: string;
  data: string;
  status: string;
  created_at: string;
};
type AdminData = {
  user: Staff;
  settings: Settings | null;
  entries: Entry[];
  orders: RecordRow[];
  reservations: RecordRow[];
  media: { id: string; url: string; name: string }[];
  counts: { event: string; count: number }[];
  trend: { day: string; count: number }[];
  confirmed: number;
  activity: ActivityReport;
  rewards: { code: string; title: string; status: string; id: string }[];
};
const sections = [
  ["overview", "Restaurant desk", LayoutDashboard],
  ["meals", "Food menu", UtensilsCrossed],
  ["categories", "Menu categories", Tags],
  ["specials", "Current specials", Sparkles],
  ["orders", "Order requests", ShoppingBag],
  ["reservations", "Reservations", CalendarDays],
  ["campaigns", "Coupons & offers", Gift],
  ["posts", "Stories & journal", FileText],
  ["events", "Events", CalendarDays],
  ["loyalty", "Customer recognition", Users],
  ["testimonials", "Testimonials", MessageSquare],
  ["media", "Photos & uploads", ImageIcon],
  ["publishing", "Publish everywhere", Radio],
  ["analytics", "Guest activity", BarChart3],
  ["settings", "Restaurant settings", SettingsIcon],
] as const;
const kinds = [
  "meals",
  "categories",
  "specials",
  "campaigns",
  "posts",
  "events",
  "loyalty",
  "testimonials",
];
const navGroups: Record<string, string> = {
  overview: "YOUR DAY",
  meals: "FOOD & GUESTS",
  posts: "YOUR RESTAURANT STORY",
  media: "TOOLS & PREFERENCES",
};
function blank(kind: Kind): Entry {
  return {
    id: crypto.randomUUID(),
    kind,
    title: "",
    titleFr: "",
    description: "",
    descriptionFr: "",
    active: kind === "meals" || kind === "categories",
    available: true,
    featured: false,
    sort: 10,
    price: null,
    priceVisibility: "inherit",
    image: "",
    category: "",
    status: kind === "meals" || kind === "categories" ? "published" : "draft",
    discountType: "percent",
    discountValue: 10,
    claimLimit: 10,
    perCustomerLimit: 1,
    activationDays: 0,
    validityDays: 7,
    minOrder: 0,
    maxDiscount: 0,
  };
}
export function Admin() {
  const [session, setSession] = useState<{
    user: Staff | null;
    configured: boolean;
  } | null>(null);
  const [data, setData] = useState<AdminData | null>(null);
  const [section, setSection] = useState("overview");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Entry | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  async function load() {
    const r = await fetch("/api/admin/data");
    const b = await r.json();
    if (!r.ok) throw new Error(b.error);
    setData(b);
  }
  useEffect(() => {
    if (new URLSearchParams(location.search).has("social"))
      setSection("publishing");
    if (new URLSearchParams(location.search).has("coupon"))
      setSection("orders");
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((s) => {
        setSession(s);
        if (s.user) void load().catch((e) => setError(e.message));
      })
      .catch(() => setError("Unable to connect. Please refresh."));
  }, []);
  async function run(route: string, b: unknown) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await api(route, b);
      await load();
      setMessage("Changes saved.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api("admin/login", {
        email: f.get("email"),
        password: f.get("password"),
      });
      const r = await fetch("/api/admin/session");
      setSession(await r.json());
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!session)
    return (
      <div className="admin-login">
        <p role="status">Opening the NVO workspace…</p>
        {error && <p>{error}</p>}
      </div>
    );
  if (!session.user)
    return (
      <div className="admin-login">
        <div className="login-card">
          <ChefPortrait />
          <Brand />
          <h1>Welcome back, NVO team.</h1>
          <p>
            Your menu, your guests, your restaurant. Everything you need for a
            good day at NVO.
          </p>
          {!session.configured && (
            <div className="admin-note">
              Your staff account is not ready yet. Please ask the restaurant
              owner to finish account setup.
            </div>
          )}
          <form className="form" onSubmit={signIn}>
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}
            <button className="button" disabled={busy || !session.configured}>
              {busy ? "Signing in…" : "Open my restaurant desk"}
              <ArrowUpRight size={17} />
            </button>
          </form>
          <Link href="/">← Back to the restaurant</Link>
        </div>
      </div>
    );
  if (!data)
    return (
      <div className="admin-login">
        <p>{error || "Loading your workspace…"}</p>
      </div>
    );
  const role = data.user.role;
  const content = ["owner", "manager", "content"].includes(role);
  const operations = ["owner", "manager", "service"].includes(role);
  const visibleSections = sections.filter(
    ([id]) =>
      id === "overview" ||
      id === "analytics" ||
      (id === "settings"
        ? role === "owner"
        : ["orders", "reservations"].includes(id)
          ? operations
          : id === "campaigns"
            ? ["owner", "manager"].includes(role)
            : content),
  );
  const title = sections.find((s) => s[0] === section)?.[1] || "Overview";
  const count = (event: string) =>
    data.counts.find((c) => c.event === event)?.count || 0;
  const sectionEntries = data.entries.filter((e) => e.kind === section);
  const filteredEntries = sectionEntries.filter(
    (e) =>
      e.title.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "samples"
          ? e.demo
          : filter === "published"
            ? e.active && e.status !== "draft"
            : !e.active || e.status === "draft")),
  );
  function navigate(id: string) {
    setSection(id);
    setSearch("");
    setFilter("all");
    setError("");
    setMessage("");
  }
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand />
        <nav aria-label="Staff workspace">
          {visibleSections.map(([id, label, Icon]) => (
            <div key={id}>
              {navGroups[id] && (
                <span className="admin-nav-group">{navGroups[id]}</span>
              )}
              <button
                className={id === section ? "active" : ""}
                key={id}
                onClick={() => {
                  navigate(id);
                }}
              >
                <Icon size={17} />
                {label}
              </button>
            </div>
          ))}
        </nav>
        <Link href="/" target="_blank">
          View the restaurant ↗
        </Link>
      </aside>
      <div className="admin-main">
        <select
          className="admin-mobile-select"
          aria-label="Choose workspace page"
          value={section}
          onChange={(e) => navigate(e.target.value)}
        >
          {visibleSections.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <div className="admin-top">
          <div>
            <span className="eyebrow">NVO · STAFF WORKSPACE</span>
            <h1>{title}</h1>
            <p>
              {data.user.email} · {role}
            </p>
          </div>
          <div className="admin-actions">
            {kinds.includes(section) && (
              <button
                className="button small"
                onClick={() => setEdit(blank(section as Kind))}
              >
                <Plus size={16} />
                Add{" "}
                {section === "meals"
                  ? "a dish"
                  : section === "categories"
                    ? "a category"
                    : section === "posts"
                      ? "a story"
                      : "new"}
              </button>
            )}
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={async () => {
                await api("admin/logout", {});
                setSession({ user: null, configured: true });
                setData(null);
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
        <StaffGuide section={section} />
        {data.settings?.previewContent && (
          <div className="sample-admin-note">
            <span>
              <strong>Your design preview is populated.</strong> Sample stories
              and occasions are labelled on the website. Edit them here, archive
              individual items, or hide the entire sample collection.
            </span>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                run("admin/settings", {
                  ...data.settings,
                  previewContent: false,
                })
              }
            >
              Hide all sample content
            </button>
          </div>
        )}
        {section === "overview" && (
          <div className="quick-actions">
            {[
              [
                "meals",
                "Update the menu",
                "Photos, dishes and prices",
                UtensilsCrossed,
              ],
              [
                "orders",
                "Take care of orders",
                `${data.orders.filter((o) => o.status === "request_created").length} requests to review`,
                ShoppingBag,
              ],
              [
                "reservations",
                "Welcome your guests",
                "Check table requests",
                CalendarDays,
              ],
            ]
              .filter(([id]) => visibleSections.some((s) => s[0] === id))
              .map(([id, label, description, Icon]) => {
                const I = Icon as typeof ShoppingBag;
                return (
                  <button
                    key={String(id)}
                    className="quick-action"
                    onClick={() => navigate(String(id))}
                  >
                    <I size={27} />
                    <span>
                      <strong>{String(label)}</strong>
                      <small>{String(description)}</small>
                    </span>
                    <ArrowUpRight size={17} />
                  </button>
                );
              })}
          </div>
        )}
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="success-message" role="status">
            {message}
          </div>
        )}
        {section === "overview" && (
          <>
            <div className="stats-grid">
              {[
                ["Page views · 30 days", count("page_view")],
                ["Menu views · 30 days", count("menu_view")],
                ["WhatsApp clicks · 30 days", count("whatsapp_order_clicked")],
                ["Paid website orders · all time", data.confirmed],
              ].map(([label, value]) => (
                <div className="stat-card" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <div className="admin-panel">
              <h2>A clear view of your customer journey</h2>
              <p>
                Visits and clicks represent interest. Only staff-recorded
                fulfilled and paid orders count as sales. Optional analytics
                includes visitors who consent. Staff browsers, local testing,
                preview mode and earlier mixed records are excluded. Open Guest
                activity for explanations and historical counts.
              </p>
              {data.trend.length ? (
                <div className="chart">
                  {data.trend.map((d) => (
                    <div
                      title={`${d.day}: ${d.count} page views`}
                      key={d.day}
                      style={{
                        height: Math.max(
                          5,
                          (d.count /
                            Math.max(...data.trend.map((x) => x.count))) *
                            115,
                        ),
                      }}
                    >
                      <span>{d.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty" style={{ minHeight: 140 }}>
                  <BarChart3 size={30} />
                  <p>
                    No traffic recorded yet. Real activity will appear here.
                  </p>
                </div>
              )}
            </div>
            <div className="admin-grid">
              <div className="admin-panel">
                <h2>Start with the menu</h2>
                <p>
                  Review meal names, images and availability. Prices can be
                  hidden or shown per meal.
                </p>
                {content && (
                  <button
                    className="button small outline"
                    onClick={() => setSection("meals")}
                  >
                    Manage meals
                  </button>
                )}
              </div>
              <div className="admin-panel">
                <h2>Something special today?</h2>
                <p>
                  Create a current special with a start and end date. It appears
                  on the homepage and Current specials page during its published
                  window. Each special gets its own shareable link.
                </p>
                {content && (
                  <button
                    className="button small outline"
                    onClick={() => setEdit(blank("specials"))}
                  >
                    Create a special
                  </button>
                )}
              </div>
              <div className="admin-panel">
                <h2>Close the loop</h2>
                <p>
                  Match the order reference in WhatsApp, agree a quote when
                  needed and record the confirmed outcome.
                </p>
                {operations && (
                  <button
                    className="button small outline"
                    onClick={() => setSection("orders")}
                  >
                    View requests
                  </button>
                )}
              </div>
            </div>
          </>
        )}
        {section === "analytics" && (
          <GuestActivity
            report={data.activity}
            refresh={() => void load().catch((e) => setError(e.message))}
          />
        )}
        {kinds.includes(section) && (
          <>
            <div className="admin-filter">
              <input
                aria-label="Search items"
                placeholder={`Search ${title.toLowerCase()}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Filter items"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All items</option>
                <option value="published">Published</option>
                <option value="hidden">Drafts & hidden</option>
                <option value="samples">Sample content</option>
              </select>
              <span>{filteredEntries.length} items</span>
            </div>
            {section === "campaigns" && (
              <div className="admin-note">
                Each offer allows one claim per IP address, including shared
                Wi-Fi. Guests enter their name and receive a personal card.
                Increasing the total quantity makes cards available to new
                guests. Check names and redeem cards in Order requests.
              </div>
            )}
            <div className="admin-list">
              {filteredEntries.map((e) => (
                <div className="admin-row" key={e.id}>
                  {e.image && <img src={e.image} alt="" />}
                  <div className="row-copy">
                    <strong>{e.title}</strong>
                    <p>
                      {e.kind === "meals"
                        ? `${e.price == null ? "No price entered" : e.price + " FCFA"} · ${e.priceVisibility === "show" ? "Price visible" : e.priceVisibility === "hide" ? "Price hidden" : "Uses restaurant price setting"}`
                        : e.description.slice(0, 90)}
                    </p>
                  </div>
                  <span className="tag">
                    {e.demo
                      ? "Sample"
                      : !e.active || e.status === "draft"
                        ? "Draft / hidden"
                        : e.startsAt && Date.parse(e.startsAt) > Date.now()
                          ? "Scheduled"
                          : e.endsAt && Date.parse(e.endsAt) <= Date.now()
                            ? "Expired"
                            : "Published"}
                  </span>
                  <button className="text-button" onClick={() => setEdit(e)}>
                    Edit
                  </button>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Hide “${e.title}” from the website? You can publish it again from Edit.`,
                        )
                      )
                        void run("admin/delete", { id: e.id });
                    }}
                  >
                    Archive
                  </button>
                </div>
              ))}
            </div>
            {sectionEntries.length > 0 && filteredEntries.length === 0 && (
              <div className="admin-panel empty">
                <h2>No matching items.</h2>
                <p>Try another search or choose All items.</p>
              </div>
            )}
            {!data.entries.some((e) => e.kind === section) && (
              <div className="admin-panel empty">
                <Plus size={30} />
                <h2>Make this space yours.</h2>
                <p>
                  Create your first item. Drafts stay private until you publish.
                </p>
                <button
                  className="button"
                  onClick={() => setEdit(blank(section as Kind))}
                >
                  Create {title.toLowerCase()}
                </button>
              </div>
            )}
          </>
        )}
        {section === "orders" && (
          <>
            {data.orders.length ? (
              data.orders.map((o) => (
                <Order key={o.id} order={o} run={run} busy={busy} />
              ))
            ) : (
              <div className="admin-panel empty">
                <ShoppingBag size={30} />
                <h2>No order requests yet.</h2>
                <p>
                  Requests appear here when a customer prepares their WhatsApp
                  order.
                </p>
              </div>
            )}
            <CouponDesk rewards={data.rewards} onChanged={load} />
          </>
        )}
        {section === "reservations" && (
          <div className="admin-list">
            {data.reservations.length ? (
              data.reservations.map((r) => {
                const d = JSON.parse(r.data);
                return (
                  <article key={r.id} className="admin-panel">
                    <h2>
                      {d.name} · {d.guests} guests
                    </h2>
                    <p>
                      {r.id} · {d.date} at {d.time} (Cotonou)
                    </p>
                    <p>
                      {d.phone} · {d.message}
                    </p>
                    <span className="status-pill">{r.status}</span>
                    <div className="order-controls">
                      <button
                        onClick={() =>
                          run("admin/reservation", {
                            id: r.id,
                            status: "confirmed",
                          })
                        }
                      >
                        Confirm table
                      </button>
                      <button
                        onClick={() =>
                          run("admin/reservation", {
                            id: r.id,
                            status: "cancelled",
                          })
                        }
                      >
                        Cancel request
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="admin-panel empty">
                <CalendarDays />
                <h2>No reservations yet.</h2>
                <p>Table requests will appear here.</p>
              </div>
            )}
          </div>
        )}
        {section === "media" && (
          <Media data={data} reload={load} setError={setError} />
        )}
        {section === "settings" && data.settings && (
          <SettingsForm
            initial={data.settings}
            campaigns={data.entries.filter((e) => e.kind === "campaigns")}
            run={run}
            busy={busy}
          />
        )}
        {section === "publishing" && (
          <SocialStudio
            posts={data.entries.filter((e) =>
              ["posts", "events", "specials"].includes(e.kind),
            )}
            edit={setEdit}
            create={() => setEdit(blank("posts"))}
          />
        )}
      </div>
      {edit && (
        <Editor
          entry={edit}
          entries={data.entries}
          media={data.media}
          close={() => setEdit(null)}
          save={async (value) => {
            if (await run("admin/entry", value)) setEdit(null);
          }}
          busy={busy}
          error={error}
        />
      )}
    </div>
  );
}
function Order({
  order,
  run,
  busy,
}: {
  order: RecordRow;
  run: (r: string, b: unknown) => Promise<boolean>;
  busy: boolean;
}) {
  const d = JSON.parse(order.data);
  const [amount, setAmount] = useState("");
  const [reviewed, setReviewed] = useState(false);
  return (
    <article className="admin-panel">
      <h2>
        {order.id} · {d.name}
      </h2>
      <p>
        {new Date(order.created_at).toLocaleString()} · {d.phone} · {d.method}
      </p>
      <span className="status-pill">{order.status.replaceAll("_", " ")}</span>
      <div className="order-details">
        {d.items
          ?.map(
            (i: { quantity: number; title: string }) =>
              `${i.quantity} × ${i.title}`,
          )
          .join("\n")}
        {"\n"}
        {d.address}
        {"\n"}
        {d.notes}
        {d.coupon ? `\nCoupon: ${d.coupon}` : ""}
        {"\n"}
        {d.pending
          ? "Total awaiting agreement"
          : `Agreed / food total: ${d.total} FCFA`}
      </div>
      {d.pending && (
        <div className="form" style={{ marginTop: 20 }}>
          <label>
            Final agreed net total (FCFA)
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          {d.rewardId && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              I have checked the coupon terms and applied the correct benefit.
            </label>
          )}
          <button
            className="button small outline"
            disabled={busy || !amount}
            onClick={() =>
              run("admin/quote", {
                id: order.id,
                total: Number(amount),
                offerReviewed: reviewed,
              })
            }
          >
            Record agreed quote
          </button>
        </div>
      )}
      <div className="order-controls">
        <button
          disabled={busy || order.status === "fulfilled_paid"}
          onClick={() =>
            run("admin/order", { id: order.id, status: "accepted" })
          }
        >
          Mark accepted
        </button>
        <button
          disabled={busy || d.pending || order.status === "fulfilled_paid"}
          onClick={() =>
            run("admin/order", { id: order.id, status: "fulfilled_paid" })
          }
        >
          Mark fulfilled & paid
        </button>
        <button
          disabled={busy || order.status === "fulfilled_paid"}
          onClick={() =>
            run("admin/order", { id: order.id, status: "cancelled" })
          }
        >
          Cancel request
        </button>
      </div>
    </article>
  );
}
function Editor({
  entry,
  entries,
  media,
  close,
  save,
  busy,
  error,
}: {
  entry: Entry;
  entries: Entry[];
  media: AdminData["media"];
  close: () => void;
  save: (e: Entry & { social?: SocialPlan }) => Promise<void>;
  busy: boolean;
  error: string;
}) {
  const [e, setE] = useState<Entry>(entry);
  const [social, setSocial] = useState<SocialPlan>();
  const [translationReady, setTranslationReady] = useState(true);
  const socialKind = ["posts", "events", "specials"].includes(entry.kind);
  const [socialReady, setSocialReady] = useState(!socialKind);
  const set = (key: string, value: unknown) =>
    setE((old) => ({ ...old, [key]: value }));
  const numeric = (key: string, label: string, min = 0, max = 10000000) => (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={String((e as unknown as Record<string, unknown>)[key] ?? "")}
        onChange={(ev) =>
          set(key, ev.target.value === "" ? undefined : Number(ev.target.value))
        }
      />
    </label>
  );
  const timeValue = (v?: string) =>
    v ? new Date(Date.parse(v) + 3600000).toISOString().slice(0, 16) : "";
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function key(ev: KeyboardEvent) {
      if (ev.key === "Escape") close();
      if (ev.key === "Tab") {
        const focusable = Array.from(
          document.querySelectorAll<HTMLElement>(
            ".editor-dialog button:not([disabled]), .editor-dialog input:not([disabled]), .editor-dialog textarea:not([disabled]), .editor-dialog select:not([disabled])",
          ),
        );
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (ev.shiftKey && document.activeElement === first) {
          ev.preventDefault();
          last?.focus();
        } else if (!ev.shiftKey && document.activeElement === last) {
          ev.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
    };
  }, [close]);
  return (
    <div
      className="admin-editor"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) close();
      }}
    >
      <div
        className="editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
      >
        <div className="editor-header">
          <h2 id="editor-title">
            {entry.title ? "Edit" : "Add"}{" "}
            {
              {
                meals: "a dish",
                categories: "a menu category",
                posts: "a story",
                specials: "a special",
                campaigns: "an offer",
                events: "an occasion",
                loyalty: "recognition",
                testimonials: "guest feedback",
              }[entry.kind]
            }
          </h2>
          <button onClick={close} aria-label="Close editor">
            <X />
          </button>
        </div>
        <form
          className="form"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (socialReady && translationReady)
              void save({ ...e, ...(socialKind ? { social } : {}) });
          }}
        >
          <BilingualFields
            value={e}
            change={(patch) => setE((old) => ({ ...old, ...patch }))}
            ready={setTranslationReady}
          />
          {e.kind !== "categories" && (
            <label>
              Image
              <select
                value={e.image || ""}
                onChange={(ev) => set("image", ev.target.value)}
              >
                <option value="">No image</option>
                {[
                  ["banga", "Banga soup"],
                  ["rice-fish", "Rice, fish & plantain"],
                  ["soup", "Soup"],
                  ["fish-rice", "Fish rice"],
                  ["drinks", "Drinks menu"],
                ].map(([id, title]) => (
                  <option value={`/images/${id}.jpeg`} key={id}>
                    {title}
                  </option>
                ))}
                {media.map((m) => (
                  <option key={m.id} value={m.url}>
                    {m.name}
                  </option>
                ))}
                {[
                  "banga-detail",
                  "table-spread",
                  "peppered-bites",
                  "nvo-oclock",
                  "rice-flyer",
                  "vegetable-flyer",
                  "menu-jollof",
                  "menu-shawarma",
                  "menu-plantain",
                ].map((id) => (
                  <option key={id} value={`/images/${id}.webp`}>
                    {id.replaceAll("-", " ")}
                  </option>
                ))}
              </select>
              {e.image && (
                <img
                  className="editor-preview"
                  src={e.image}
                  alt="Selected picture preview"
                />
              )}
            </label>
          )}
          {e.kind === "meals" && (
            <>
              <label>
                Category
                <select
                  value={e.category || ""}
                  onChange={(ev) => set("category", ev.target.value)}
                >
                  <option value="">Uncategorised</option>
                  {entries
                    .filter((x) => x.kind === "categories")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                </select>
              </label>
              <div className="form-row">
                <label>
                  Price · FCFA (leave empty for quote)
                  <input
                    type="number"
                    min={0}
                    max={10000000}
                    value={e.price ?? ""}
                    onChange={(ev) =>
                      set(
                        "price",
                        ev.target.value === "" ? null : Number(ev.target.value),
                      )
                    }
                  />
                </label>
                <label>
                  Public price visibility
                  <select
                    value={e.priceVisibility || "inherit"}
                    onChange={(ev) => set("priceVisibility", ev.target.value)}
                  >
                    <option value="inherit">Use restaurant default</option>
                    <option value="show">Show this price</option>
                    <option value="hide">Hide this price</option>
                  </select>
                </label>
              </div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={e.available !== false}
                  onChange={(ev) => set("available", ev.target.checked)}
                />
                Available to request
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={!!e.preorder} onChange={ev => set("preorder", ev.target.checked)} />
                Pre-order required / Sur commande
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={!!e.featured}
                  onChange={(ev) => set("featured", ev.target.checked)}
                />
                Feature on homepage
              </label>
              <label>
                Badge
                <input
                  maxLength={60}
                  value={e.badge || ""}
                  onChange={(ev) => set("badge", ev.target.value)}
                />
              </label>
            </>
          )}
          {e.kind === "campaigns" && (
            <>
              <div className="admin-note">
                Each offer has one claim pool. Create a new offer for a new
                campaign. Issued coupons keep a snapshot of their terms. Each
                offer allows one claim per IP address, including shared Wi-Fi.
                Increasing the total releases cards for new guests. Verify
                identity with staff for valuable rewards.
              </div>
              <div className="form-row">
                <label>
                  Benefit type
                  <select
                    value={e.discountType || "percent"}
                    onChange={(ev) => set("discountType", ev.target.value)}
                  >
                    <option value="percent">Percentage off</option>
                    <option value="fixed">Fixed FCFA amount</option>
                    <option value="free">One free selected meal</option>
                  </select>
                </label>
                {numeric(
                  "discountValue",
                  "Benefit amount",
                  0,
                  e.discountType === "percent" ? 100 : 10000000,
                )}
              </div>
              {e.discountType === "free" && (
                <label>
                  Free meal
                  <select
                    required
                    value={e.rewardItem || ""}
                    onChange={(ev) => set("rewardItem", ev.target.value)}
                  >
                    <option value="">Choose a meal</option>
                    {entries
                      .filter((x) => x.kind === "meals")
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.title}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <div className="form-row">
                {numeric("minOrder", "Minimum order (FCFA)")}
                {numeric("maxDiscount", "Maximum discount (0 = uncapped)")}
              </div>
              <div className="form-row">
                {numeric("claimLimit", "Total claims allowed", 1, 100000)}
                <p className="form-note">
                  One coupon per IP address for this offer. Shared Wi-Fi counts
                  as one address.
                </p>
              </div>
              <div className="form-row">
                {numeric("activationDays", "Activation delay (days)", 0, 365)}
                {numeric(
                  "validityDays",
                  "Validity after activation (days)",
                  1,
                  365,
                )}
              </div>
            </>
          )}
          {e.kind !== "meals" && e.kind !== "categories" && (
            <div className="form-row">
              <label>
                Publish / open from (Cotonou)
                <input
                  type="datetime-local"
                  value={timeValue(e.startsAt)}
                  onChange={(ev) =>
                    set(
                      "startsAt",
                      ev.target.value
                        ? new Date(ev.target.value + ":00+01:00").toISOString()
                        : "",
                    )
                  }
                />
              </label>
              <label>
                Expire / close at (Cotonou)
                <input
                  type="datetime-local"
                  value={timeValue(e.endsAt)}
                  onChange={(ev) =>
                    set(
                      "endsAt",
                      ev.target.value
                        ? new Date(ev.target.value + ":00+01:00").toISOString()
                        : "",
                    )
                  }
                />
              </label>
            </div>
          )}
          {e.kind === "events" && (
            <>
              <label>
                Event date / time (Cotonou)
                <input
                  type="datetime-local"
                  value={timeValue(e.date)}
                  onChange={(ev) =>
                    set(
                      "date",
                      ev.target.value
                        ? new Date(ev.target.value + ":00+01:00").toISOString()
                        : "",
                    )
                  }
                />
              </label>
              <label>
                Location
                <input
                  value={e.location || ""}
                  onChange={(ev) => set("location", ev.target.value)}
                />
              </label>
            </>
          )}
          {e.kind === "loyalty" && (
            <>
              {numeric("position", "Position (1–3)", 1, 3)}
              <label>
                Recognition date
                <input
                  type="date"
                  value={e.date?.slice(0, 10) || ""}
                  onChange={(ev) => set("date", ev.target.value)}
                />
              </label>
            </>
          )}
          <div className="form-row">
            {numeric(
              "sort",
              "Order on the page (smaller numbers first)",
              0,
              10000,
            )}
            <label>
              Who can see this?
              <select
                value={
                  !e.active || e.status === "draft" ? "draft" : "published"
                }
                onChange={(ev) =>
                  setE((old) => ({
                    ...old,
                    status: ev.target.value as "draft" | "published",
                    active: ev.target.value === "published",
                  }))
                }
              >
                <option value="draft">Only staff — save as a draft</option>
                <option value="published">
                  Everyone — publish on the website
                </option>
              </select>
            </label>
          </div>
          <p className="form-note">
            If you set start and end dates, this item appears only during those
            dates. Drafts stay private.
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={!!e.demo}
              onChange={(ev) => set("demo", ev.target.checked)}
            />
            Sample content (labelled in design preview; hidden when sample
            content is switched off)
          </label>
          {socialKind && (
            <SocialOptions
              contentReady={translationReady}
              entry={e}
              onChange={setSocial}
              onReady={setSocialReady}
            />
          )}
          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
          <div className="button-row">
            <button
              className="button"
              disabled={busy || !socialReady || !translationReady}
            >
              {busy
                ? "Saving…"
                : e.active && e.status !== "draft"
                  ? "Save & publish"
                  : "Save draft"}
              <Check size={16} />
            </button>
            <button type="button" className="button outline" onClick={close}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
function Media({
  data,
  reload,
  setError,
}: {
  data: AdminData;
  reload: () => Promise<void>;
  setError: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <>
      <div className="media-upload">
        <ImageIcon
          size={32}
          style={{ color: "var(--gold)", marginBottom: 12 }}
        />
        <h2>Bring your food into focus.</h2>
        <p>
          JPEG, PNG or WebP · up to 8 MB. Only upload images you have permission
          to publish.
        </p>
        <input
          aria-label="Upload a restaurant photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError("");
            try {
              const f = new FormData();
              f.append("file", file);
              const r = await fetch("/api/admin/upload", {
                method: "POST",
                body: f,
              });
              const b = await r.json();
              if (!r.ok) throw new Error(b.error);
              await reload();
              setNotice(
                "Photo uploaded. You can now select it when editing a dish or story.",
              );
              e.target.value = "";
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
        {busy && <p role="status">Updating your photo library…</p>}
      </div>
      {notice && (
        <p className="success-message" role="status">
          {notice}
        </p>
      )}
      <div className="admin-filter">
        <input
          aria-label="Search photos"
          placeholder="Find a photo by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span>{data.media.length} uploaded photos</span>
      </div>
      <div className="admin-grid">
        {data.media
          .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
          .map((m) => (
            <div className="admin-media" key={m.id}>
              <img src={m.url} alt={m.name} />
              <p>{m.name}</p>
              <p>
                {data.entries.some((e) => e.image === m.url)
                  ? "Used on the website or in a draft"
                  : "Ready to use"}
              </p>
              <button
                className="danger-button"
                disabled={busy}
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Permanently delete “${m.name}”? This removes the uploaded file. Your original on your device is not affected.`,
                    )
                  )
                    return;
                  setBusy(true);
                  setError("");
                  setNotice("");
                  try {
                    await api("admin/media/delete", { id: m.id });
                    await reload();
                    setNotice("Photo deleted from your library.");
                  } catch (err) {
                    setError((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Trash2 size={14} />
                Delete photo
              </button>
            </div>
          ))}
      </div>
      {data.media.length === 0 && (
        <div className="admin-panel empty">
          <ImageIcon size={30} />
          <h2>Your next delicious photo belongs here.</h2>
          <p>
            Upload a picture above. The original NVO design photographs are
            already available in the page editor.
          </p>
        </div>
      )}
    </>
  );
}
function SettingsForm({
  initial,
  campaigns,
  run,
  busy,
}: {
  initial: Settings;
  campaigns: Entry[];
  run: (r: string, b: unknown) => Promise<boolean>;
  busy: boolean;
}) {
  const [s, setS] = useState(initial);
  const field = (key: keyof Settings, label: string) => (
    <label>
      {label}
      <input
        value={String(s[key])}
        onChange={(e) => setS({ ...s, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <form
      className="form admin-panel admin-settings"
      onSubmit={(e) => {
        e.preventDefault();
        void run("admin/settings", s);
      }}
    >
      <h2>Restaurant details</h2>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={!!s.previewContent}
          onChange={(e) => setS({ ...s, previewContent: e.target.checked })}
        />
        Show labelled sample stories and occasions in the design preview
      </label>
      <p className="form-note">
        Switch this off before launch. Samples stay in your account so you can
        edit or archive them later. No sample sales, reviews or rewards are
        created.
      </p>
      {field("name", "Restaurant name")}
      {field("address", "Public address")}
      {field("whatsapp", "WhatsApp destination · country code and digits only")}
      {field("email", "Public email (optional)")}
      {field("hours", "Confirmed opening / kitchen hours (optional)")}
      {field("instagram", "Instagram URL (optional)")}
      <h2>Menu and prices</h2>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={s.showPrices}
          onChange={(e) => setS({ ...s, showPrices: e.target.checked })}
        />
        Show prices by default (individual meal settings can override)
      </label>
      <h2>Location</h2>
      {field("mapsUrl", "Google Maps link")}
      <div className="form-row">
        <label>
          Latitude
          <input
            type="number"
            step="any"
            value={s.latitude}
            onChange={(e) => setS({ ...s, latitude: Number(e.target.value) })}
          />
        </label>
        <label>
          Longitude
          <input
            type="number"
            step="any"
            value={s.longitude}
            onChange={(e) => setS({ ...s, longitude: Number(e.target.value) })}
          />
        </label>
      </div>
      <h2>Friend invitations</h2>
      <p className="form-note">
        A friend can claim the selected campaign. Rewards for the referrer after
        a sale are not automated in this build.
      </p>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={s.referralEnabled}
          onChange={(e) => setS({ ...s, referralEnabled: e.target.checked })}
        />
        Enable friend invitations
      </label>
      <label>
        Referral campaign
        <select
          value={s.referralCampaign}
          onChange={(e) => setS({ ...s, referralCampaign: e.target.value })}
        >
          <option value="">Choose a campaign</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Claim window after friend opens invitation (minutes)
        <input
          type="number"
          min={1}
          max={1440}
          value={s.referralClaimMinutes}
          onChange={(e) =>
            setS({ ...s, referralClaimMinutes: Number(e.target.value) })
          }
        />
      </label>
      <button className="button" disabled={busy}>
        {busy ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
