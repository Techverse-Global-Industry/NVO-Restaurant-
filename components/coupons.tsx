"use client";
import { useEffect, useState } from "react";
import Link from "./locale-link";
import {
  Check,
  Copy,
  Download,
  Gift,
  MapPin,
  Phone,
  Ticket,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { api, useNvo } from "./provider";
import type { Entry, Reward, Settings } from "@/lib/types";
export type Coupon = Reward & { offer?: Partial<Entry> };
const escape = (v: string) =>
  v.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const date = (v: string, fr = false) =>
  new Intl.DateTimeFormat(fr ? "fr-FR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Porto-Novo",
  }).format(new Date(v));
function benefit(e?: Partial<Entry>) {
  if (e?.discountType === "percent") return `${e.discountValue || 0}%`;
  if (e?.discountType === "fixed") return `${e.discountValue || 0} FCFA`;
  return "NVO";
}
export async function downloadCoupon(r: Coupon, s: Settings, fr: boolean) {
  const QR = await import("qrcode");
  const qr = await QR.toDataURL(
    location.origin + "/admin?coupon=" + encodeURIComponent(r.code),
    { width: 180, margin: 1, color: { dark: "#123468", light: "#ffffff" } },
  );
  const wrap = (v: string, width = 83) =>
    v
      .split(/\n/)
      .flatMap(
        (line) =>
          line.match(
            new RegExp(`.{1,${width}}(?:\\s|$)|\\S{1,${width}}`, "gu"),
          ) || [""],
      );
  const terms = wrap(
    (fr ? r.offer?.descriptionFr : r.offer?.description) ||
      r.offer?.description ||
      "",
  );
  const title = wrap((fr ? r.offer?.titleFr : r.title) || r.title, 40);
  const name = wrap(r.claimant_name || "NVO Guest", 36);
  const top =
    320 +
    Math.max(0, title.length - 1) * 40 +
    Math.max(0, name.length - 1) * 30;
  const height = top + 500 + terms.length * 23;
  const lines = (
    values: string[],
    x: number,
    y: number,
    size: number,
    color: string,
    step = size + 8,
  ) =>
    values
      .map(
        (v, i) =>
          `<text x="${x}" y="${y + i * step}" fill="${color}" font-size="${size}">${escape(v.trim())}</text>`,
      )
      .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}"><defs><linearGradient id="royal" x2="1" y2="1"><stop stop-color="#061c42"/><stop offset="1" stop-color="#154c8a"/></linearGradient></defs><rect width="1000" height="${height}" rx="28" fill="#faf7ef"/><rect width="1000" height="${top + 45}" rx="28" fill="url(#royal)"/><rect x="22" y="22" width="956" height="${height - 44}" rx="18" fill="none" stroke="#c9a558" stroke-width="2"/><g font-family="Arial,sans-serif"><text x="60" y="85" fill="#dfc486" font-size="18" letter-spacing="5">LA TABLE NVO · COTONOU</text><text x="60" y="145" fill="white" font-size="48" font-family="Georgia,serif">NVO Restaurant</text><text x="800" y="105" fill="#dfc486" font-size="18">CLAIMED</text>${lines(title, 60, 210, 32, "#ffffff", 40)}<text x="60" y="${top - 35 - name.length * 30}" fill="#dfc486" font-size="15">${fr ? "RÉSERVÉ À" : "RESERVED FOR"}</text>${lines(name, 60, top - 25 - (name.length - 1) * 30, 27, "white", 30)}<path d="M30 ${top + 65} H970" stroke="#c9a558" stroke-dasharray="9 9"/><text x="60" y="${top + 120}" fill="#123468" font-size="35" letter-spacing="3">${escape(r.code)}</text><image href="${qr}" x="755" y="${top + 95}" width="180" height="180"/><text x="60" y="${top + 170}" fill="#123468" font-size="18">${fr ? "Obtenu le" : "Claimed"} : ${escape(date(r.claimed_at, fr))}</text><text x="60" y="${top + 208}" fill="#123468" font-size="18">${fr ? "Disponible dès" : "Active from"} : ${escape(date(r.active_at, fr))}</text><text x="60" y="${top + 246}" fill="#123468" font-size="18">${fr ? "Valable jusqu’au" : "Valid until"} : ${escape(date(r.expires_at, fr))}</text><text x="60" y="${top + 293}" fill="#123468" font-size="16">${escape(`${fr ? "Minimum" : "Minimum spend"}: ${r.offer?.minOrder || 0} FCFA${r.offer?.maxDiscount ? ` · ${fr ? "Remise maximale" : "Maximum discount"}: ${r.offer.maxDiscount} FCFA` : ""}`)}</text>${lines(terms, 60, top + 335, 16, "#304760", 23)}<text x="60" y="${height - 100}" fill="#123468" font-size="16">${escape(s.address)}</text><text x="60" y="${height - 70}" fill="#123468" font-size="17">WhatsApp +${escape(s.whatsapp)} · NVO Restaurant</text><text x="60" y="${height - 40}" fill="#526078" font-size="13">${fr ? "Usage unique. Nom et validité vérifiés par notre équipe. Heures de Cotonou." : "Single use. Name and validity checked by our team. Times shown for Cotonou."}</text></g></svg>`;
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Unable to prepare the card."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Unable to save the card."))),
        "image/png",
      ),
    );
    const png = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = png;
    a.download = r.code + ".png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(png), 30000);
    await api("reward/saved", { id: r.id });
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function CouponCard({
  reward: stored,
  settings: s,
}: {
  reward: Coupon;
  settings: Settings;
}) {
  const { tr, lang, toast } = useNvo();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [registeredName, setRegisteredName] = useState("");
  const r = {
    ...stored,
    claimant_name: stored.claimant_name || registeredName,
  };
  const fr = lang === "fr";
  const state =
    r.status === "redeemed"
      ? tr("Used", "Utilisé")
      : r.status === "held"
        ? tr("Reserved for your order", "Réservé à votre commande")
        : Date.parse(r.expires_at) <= Date.now()
          ? tr("Expired", "Expiré")
          : Date.parse(r.active_at) > Date.now()
            ? tr("Claimed · activates soon", "Obtenu · bientôt actif")
            : tr("Claimed · ready to enjoy", "Obtenu · prêt à utiliser");
  return (
    <article className="nvo-ticket" data-reveal>
      <div className="ticket-top">
        <div className="ticket-brand">
          <span>NVO</span>
          <small>RESTAURANT · COTONOU</small>
        </div>
        <span className="ticket-stamp">
          <Check size={15} />
          {state}
        </span>
        <h3>{fr ? r.offer?.titleFr || r.title : r.title}</h3>
        <p className="ticket-name-label">{tr("Reserved for", "Réservé à")}</p>
        <strong className="ticket-name">
          {r.claimant_name || tr("NVO guest", "Client NVO")}
        </strong>
      </div>
      <div className="ticket-perforation" aria-hidden="true" />
      <div className="ticket-bottom">
        {!r.claimant_name && r.status === "claimed" && (
          <form
            className="form"
            onSubmit={async (ev) => {
              ev.preventDefault();
              setSaving(true);
              try {
                const saved = await api("reward/name", { id: r.id, name });
                setRegisteredName(saved.claimant_name);
                toast(
                  tr(
                    "Your name is saved at NVO.",
                    "Votre nom est enregistré chez NVO.",
                  ),
                );
              } catch (e) {
                toast((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <label>
              {tr(
                "Add your name to this card",
                "Ajoutez votre nom à cette carte",
              )}
              <input
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
              />
            </label>
            <button className="button small" disabled={saving}>
              {tr("Save my name", "Enregistrer mon nom")}
            </button>
            <p className="form-note">
              {tr(
                "Your older coupon stays valid under its original terms.",
                "Votre ancien coupon conserve ses conditions d’origine.",
              )}
            </p>
          </form>
        )}
        <code>{r.code}</code>
        <dl>
          <div>
            <dt>{tr("Claimed", "Obtenu le")}</dt>
            <dd>{date(r.claimed_at, fr)}</dd>
          </div>
          <div>
            <dt>{tr("Active from", "Disponible dès")}</dt>
            <dd>{date(r.active_at, fr)}</dd>
          </div>
          <div>
            <dt>{tr("Valid until", "Valable jusqu’au")}</dt>
            <dd>{date(r.expires_at, fr)}</dd>
          </div>
        </dl>
        {r.offer && (
          <details>
            <summary>
              {tr("Your offer & conditions", "Votre offre et ses conditions")}
            </summary>
            <p>
              {fr
                ? r.offer.descriptionFr || r.offer.description
                : r.offer.description}
            </p>
            <p>
              {tr("Minimum spend", "Achat minimum")}: {r.offer.minOrder || 0}{" "}
              FCFA
              {r.offer.maxDiscount
                ? ` · ${tr("Maximum discount", "Remise maximale")}: ${r.offer.maxDiscount} FCFA`
                : ""}
            </p>
          </details>
        )}
        <p className="ticket-contact">
          <MapPin size={14} />
          {s.address}
          <br />
          <Phone size={14} />+{s.whatsapp}
        </p>
        <div className="button-row">
          <button
            className="button small"
            disabled={saving || (!r.claimant_name && r.status === "claimed")}
            onClick={async () => {
              setSaving(true);
              try {
                await downloadCoupon(r, s, fr);
                toast(
                  tr(
                    "Your card is ready. Your claim is recorded at NVO.",
                    "Votre carte est prête. NVO a enregistré votre coupon.",
                  ),
                );
              } catch (e) {
                toast((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <Download size={16} />
            {saving
              ? tr("Preparing…", "Préparation…")
              : tr("Download card", "Télécharger la carte")}
          </button>
          <button
            className="button outline small"
            onClick={() =>
              navigator.clipboard
                .writeText(r.code)
                .then(() => toast(tr("Code copied", "Code copié")))
                .catch(() => toast(r.code))
            }
          >
            <Copy size={15} />
            {tr("Copy code", "Copier")}
          </button>
        </div>
      </div>
    </article>
  );
}
export function OffersExperience() {
  const { data, tr, lang, toast } = useNvo();
  const [wallet, setWallet] = useState<Coupon[]>([]);
  const [availability, setAvailability] = useState<
    { id: string; remaining: number; claimed: boolean }[]
  >([]);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  async function load() {
    const [w, a] = await Promise.all([
      fetch("/api/wallet"),
      fetch("/api/offers/availability"),
    ]);
    if (w.ok) setWallet(await w.json());
    const result = await a.json();
    if (!a.ok) throw new Error(result.error);
    setAvailability(result);
    setLoaded(true);
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
    const timer = setInterval(() => {
      void load().catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, []);
  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError("");
    try {
      const reward = await api("claim", { campaignId: selected, name });
      setWallet((old) => [reward, ...old]);
      setSelected("");
      await load();
      toast(
        tr(
          "Your named NVO coupon is ready!",
          "Votre coupon NVO nominatif est prêt !",
        ),
      );
      document.getElementById("my-coupons")?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    } catch (e) {
      setError((e as Error).message);
      void load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  const campaigns = data.entries.filter((e) => e.kind === "campaigns");
  return (
    <>
      <section className="coupon-intro">
        <span className="eyebrow">
          {tr("A LITTLE EXTRA NVO", "UN PEU PLUS DE NVO")}
        </span>
        <Ticket size={42} />
        <h1>
          {tr("A little privilege.", "Un petit privilège.")}
          <br />
          <em>{tr("With your name on it.", "À votre nom.")}</em>
        </h1>
        <p>
          {tr(
            "Choose your treat. Claim your personal card. Bring it to the NVO table.",
            "Choisissez votre offre. Obtenez votre carte personnelle. Présentez-la chez NVO.",
          )}
        </p>
        <a className="underlined" href="#my-coupons">
          {tr("Open my coupon wallet", "Ouvrir mes coupons")}
          <ArrowUpRight size={16} />
        </a>
      </section>
      <section className="section content-section">
        <div className="reward-grid">
          {campaigns.map((c) => {
            const a = availability.find((a) => a.id === c.id);
            const mine = wallet.some((r) => r.campaign_id === c.id);
            const claimed = mine || a?.claimed;
            const soldOut = a?.remaining === 0;
            return (
              <article
                className={`offer-ticket ${claimed ? "is-claimed" : ""}`}
                key={c.id}
                data-reveal
              >
                <span className="eyebrow">NVO PRIVILÈGES</span>
                <div className="offer-benefit">
                  {benefit(c)}
                  <Gift size={30} />
                </div>
                <h2>{lang === "fr" ? c.titleFr || c.title : c.title}</h2>
                <p>
                  {lang === "fr"
                    ? c.descriptionFr || c.description
                    : c.description}
                </p>
                <div className="offer-facts">
                  <span>
                    {c.activationDays
                      ? tr(
                          `Starts ${c.activationDays} days after claiming`,
                          `Actif ${c.activationDays} jours après obtention`,
                        )
                      : tr("Ready immediately", "Disponible immédiatement")}
                  </span>
                  <span>
                    {tr(
                      `Valid for ${c.validityDays || 7} days after activation`,
                      `Valable ${c.validityDays || 7} jours après activation`,
                    )}
                  </span>
                  {a && (
                    <span>
                      {tr(
                        `${a.remaining} cards available`,
                        `${a.remaining} cartes disponibles`,
                      )}
                    </span>
                  )}
                </div>
                {claimed ? (
                  <div className="claim-seal">
                    <ShieldCheck size={22} />
                    <div>
                      <strong>{tr("CLAIMED", "DÉJÀ OBTENU")}</strong>
                      <small>
                        {mine
                          ? tr(
                              "Your personal card is in your wallet below.",
                              "Votre carte personnelle est dans votre portefeuille ci-dessous.",
                            )
                          : tr(
                              "A coupon was claimed on this network.",
                              "Un coupon a été obtenu sur ce réseau.",
                            )}
                      </small>
                    </div>
                  </div>
                ) : (
                  <button
                    className="button"
                    disabled={!loaded || soldOut || busy}
                    onClick={() => {
                      setSelected(c.id);
                      setError("");
                    }}
                  >
                    {soldOut
                      ? tr(
                          "All cards claimed",
                          "Toutes les cartes ont été obtenues",
                        )
                      : tr("Claim my card", "Obtenir ma carte")}
                    <ArrowUpRight size={17} />
                  </button>
                )}
                {selected === c.id && (
                  <form className="coupon-name-form form" onSubmit={submit}>
                    <label>
                      {tr(
                        "Your name, as shown on the card",
                        "Votre nom, tel qu’il figurera sur la carte",
                      )}
                      <input
                        autoFocus
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={80}
                        value={name}
                        onChange={(ev) => setName(ev.target.value)}
                      />
                    </label>
                    <p>
                      {tr(
                        "NVO records your name and claim date so staff can verify this coupon. One claim per IP address for this offer; shared Wi-Fi counts as one address.",
                        "NVO enregistre votre nom et la date pour vérifier ce coupon. Une obtention par adresse IP pour cette offre ; un Wi-Fi partagé compte comme une seule adresse.",
                      )}
                    </p>
                    <button className="button" disabled={busy}>
                      {busy
                        ? tr("Creating your card…", "Création de votre carte…")
                        : tr("Save my coupon", "Enregistrer mon coupon")}
                    </button>
                    <button
                      className="underlined"
                      type="button"
                      onClick={() => setSelected("")}
                    >
                      {tr("Cancel", "Annuler")}
                    </button>
                  </form>
                )}
              </article>
            );
          })}
        </div>
        {!campaigns.length && (
          <div className="notice">
            {tr(
              "The next little NVO treat is on its way. Explore the menu while you wait.",
              "La prochaine surprise NVO arrive bientôt. Découvrez notre carte en attendant.",
            )}{" "}
            <Link href="/menu">{tr("Our menu", "Notre carte")}</Link>
          </div>
        )}
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        <div className="wallet-intro" id="my-coupons">
          <span className="eyebrow">NVO WALLET</span>
          <h2>
            {tr(
              "Your name. Your little extras.",
              "Votre nom. Vos petits privilèges.",
            )}
          </h2>
          <p>
            {tr(
              "Your claim is already recorded at NVO. Download the card to keep your code when switching browsers. Present the card and your name to our team.",
              "Votre coupon est déjà enregistré chez NVO. Téléchargez la carte pour conserver le code en changeant de navigateur. Présentez-la avec votre nom à notre équipe.",
            )}
          </p>
        </div>
        <div className="coupon-wallet">
          {wallet.map((r) => (
            <CouponCard key={r.id} reward={r} settings={data.settings} />
          ))}
        </div>
        {!wallet.length && (
          <div className="notice">
            {tr(
              "Your claimed cards will appear here.",
              "Vos cartes apparaîtront ici après obtention.",
            )}
          </div>
        )}
      </section>
    </>
  );
}
