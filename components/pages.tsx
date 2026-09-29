"use client";
import { OffersExperience } from "./coupons";
import { useEffect, useState, useRef } from "react";
import Link from "./locale-link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowUpRight,
  Search,
  ShoppingBag,
  Minus,
  Plus,
  Trash2,
  MapPin,
  MessageCircle,
  CalendarDays,
  Gift,
  Copy,
  Download,
  Users,
  Clock,
  UtensilsCrossed,
} from "lucide-react";
import { useNvo, api, track } from "./provider";
import { MealCard } from "./meal-card";
import { KitchenFilm, SampleBadge } from "./visuals";
import { money } from "@/lib/catalog";
import type { Entry, Reward } from "@/lib/types";
import { CurrentMenu, PhotoCredit, MenuItem } from "./menu";

export function Intro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <section className="page-intro">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </section>
  );
}
function Empty({
  title,
  text,
  icon = "gift",
}: {
  title: string;
  text: string;
  icon?: string;
}) {
  return (
    <div className="empty">
      {icon === "gift" ? (
        <Gift size={35} strokeWidth={1} />
      ) : (
        <CalendarDays size={35} strokeWidth={1} />
      )}
      <h2>{title}</h2>
      <p>{text}</p>
      <Link className="underlined" href="/menu">
        Explore our menu <ArrowUpRight size={17} />
      </Link>
    </div>
  );
}
export function MenuPage() { return <CurrentMenu />; }
export function MealDetail({ id }: { id: string }) {
  const { data, tr, lang, add } = useNvo();
  const meal = data.entries.find((e) => e.kind === "meals" && e.id === id);
  if (!meal)
    return (
      <Empty
        title="Not on the menu right now"
        text="This meal may be unavailable. Explore the current menu."
      />
    );
  return (
    <section className="section content-section">
      <Link className="back-link" href="/menu">
        <ArrowLeft size={15} />
        {tr("Back to the menu", "Retour à la carte")}
      </Link>
      <div className="two-column">
        <div>
          <div className="menu-detail-image">
          {meal.image ? <Image
            src={meal.image}
            fill
            alt={lang === "fr" ? meal.titleFr || meal.title : meal.title}
            priority
            sizes="(max-width:700px) 90vw, 45vw"
            style={{ objectFit: "cover" }}
          /> : <div className="meal-photo-placeholder menu-detail-placeholder"><UtensilsCrossed size={52} strokeWidth={1} /><span>NVO RESTAURANT</span></div>}
          </div>
          <PhotoCredit image={meal.image} />
        </div>
        <div className="detail-body">
          <span className="eyebrow">{tr("THE NVO KITCHEN", "LA CUISINE NVO")}</span>
          <h1>{lang === "fr" ? meal.titleFr || meal.title : meal.title}</h1>
          <p>
            {lang === "fr"
              ? meal.descriptionFr || meal.description
              : meal.description}
          </p>
          <div className="detail-price">
            {meal.price != null
              ? money(meal.price)
              : tr("Ask us for today’s price", "Demandez le prix du jour")}
          </div>
          {meal.preorder && <p className="menu-detail-preorder"><Clock size={15} />{tr("Pre-order · confirm preparation time with our team", "Sur commande · délai à confirmer avec notre équipe")}</p>}
          <button
            className="button"
            disabled={meal.available === false}
            onClick={() => add(meal.id)}
          >
            {meal.available === false
              ? tr("Unavailable", "Indisponible")
              : tr("Add to my selection", "Ajouter à ma sélection")}
            <Plus size={18} />
          </button>
          <div className="notice">
            {tr(
              "Ordering is confirmed with our team on WhatsApp. Let us know about any allergies or dietary needs before ordering.",
              "Notre équipe confirme votre commande sur WhatsApp. Signalez toute allergie ou besoin alimentaire avant de commander.",
            )}
          </div>
          <Link className="underlined" href="/cart">
            {tr("View my selection", "Voir ma sélection")}
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
      <section className="related-menu" aria-labelledby="related-menu-title">
        <h2 id="related-menu-title">{tr("More for your table", "D’autres envies pour votre table")}</h2>
        <div className="menu-lines">{data.entries.filter(e => e.kind === "meals" && e.id !== meal.id && e.category === meal.category).slice(0, 4).map(e => <MenuItem key={e.id} meal={e} />)}</div>
        <Link className="underlined" href="/menu">{tr("Explore the full menu", "Découvrir toute la carte")}<ArrowUpRight size={16} /></Link>
      </section>
    </section>
  );
}
export function CartPage() {
  const { data, tr, cart, quantity, clear, completeOrder } = useNvo();
  const [coupon, setCoupon] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id: string; url: string } | null>(
    null,
  );
  const [quote, setQuote] = useState<{
    subtotal: number | null;
    discount: number | null;
    total: number | null;
    pending: boolean;
  } | null>(null);
  const submitting = useRef(false);
  const [method, setMethod] = useState("pickup");
  useEffect(() => {
    setQuote(null);
  }, [cart, coupon]);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("nvo-last-order") || "null",
      );
      if (
        saved &&
        typeof saved.id === "string" &&
        /^https:\/\/wa\.me\//.test(saved.url) &&
        Date.now() - saved.at < 86400000
      )
        setResult(saved);
      else sessionStorage.removeItem("nvo-last-order");
    } catch {}
  }, []);
  const visible = cart.map((c) => ({
    line: c,
    meal: data.entries.find((e) => e.id === c.id && e.kind === "meals"),
  }));
  const unpriced = visible.some((x) => x.meal?.price == null);
  const subtotal = visible.reduce(
    (n, x) => n + (x.meal?.price || 0) * x.line.quantity,
    0,
  );
  async function validate() {
    setError("");
    try {
      setQuote(await api("quote", { lines: cart, coupon }));
    } catch (e) {
      setQuote(null);
      setError((e as Error).message);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current || !cart.length) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    track("checkout_started");
    const form = new FormData(e.currentTarget);
    try {
      const submitted = cart.map((line) => ({ ...line }));
      const payload = {
        lines: submitted,
        coupon,
        name: form.get("name"),
        phone: form.get("phone"),
        method: form.get("method"),
        address: form.get("address") || "",
        notes: form.get("notes") || "",
      };
      const fingerprint = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(JSON.stringify(payload)),
          ),
        ),
      )
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      let pending: { fingerprint: string; key: string } | null = null;
      try {
        pending = JSON.parse(
          sessionStorage.getItem("nvo-pending-order") || "null",
        );
      } catch {}
      const requestKey =
        pending?.fingerprint === fingerprint
          ? pending.key
          : crypto.randomUUID();
      sessionStorage.setItem(
        "nvo-pending-order",
        JSON.stringify({ fingerprint, key: requestKey }),
      );
      const r = await api("order", { ...payload, requestKey });
      sessionStorage.setItem(
        "nvo-last-order",
        JSON.stringify({ ...r, at: Date.now() }),
      );
      sessionStorage.removeItem("nvo-pending-order");
      completeOrder(submitted);
      setResult(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Intro
        eyebrow={tr("GOOD CHOICES", "DE BONS CHOIX")}
        title={tr("A delicious little selection.", "Une sélection gourmande.")}
        description={tr(
          "Make it yours. Our team will confirm your order on WhatsApp.",
          "Faites-vous plaisir. Notre équipe confirmera votre commande sur WhatsApp.",
        )}
      />
      {result && (
        <section
          className="section order-confirmation"
          aria-label={tr("Order request saved", "Demande enregistrée")}
        >
          <div className="form">
            <div className="success-message">
              {tr("Your request is ready", "Votre demande est prête")} ·{" "}
              {result.id}
            </div>
            <p>
              {tr(
                "Your request is saved and the ordered items have left your cart. Open WhatsApp and press Send so NVO can confirm availability, pricing and your order.",
                "Votre demande est enregistrée et les plats commandés ont été retirés du panier. Ouvrez WhatsApp et appuyez sur Envoyer pour confirmer la disponibilité, les prix et la commande avec NVO.",
              )}
            </p>
            <a
              className="button gold"
              href={result.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("whatsapp_order_clicked")}
            >
              <MessageCircle size={18} />
              {tr("Send on WhatsApp", "Envoyer sur WhatsApp")}
            </a>
            <Link className="underlined" href="/menu">
              {tr("Start a new selection", "Commencer une nouvelle sélection")}{" "}
              <ArrowUpRight size={16} />
            </Link>
            <p className="form-note">
              {tr(
                "This is a request, not a confirmed or paid order.",
                "Il s’agit d’une demande, pas d’une commande confirmée ou payée.",
              )}
            </p>
          </div>
        </section>
      )}
      {!cart.length ? (
        result ? null : (
          <div className="section empty">
            <ShoppingBag size={40} strokeWidth={1} />
            <h2>{tr("Your table is waiting.", "Votre table vous attend.")}</h2>
            <p>
              {tr(
                "Add a little something delicious to get started.",
                "Ajoutez un plat gourmand pour commencer.",
              )}
            </p>
            <Link className="button" href="/menu">
              {tr("Explore the menu", "Découvrir la carte")}
              <ArrowUpRight size={18} />
            </Link>
          </div>
        )
      ) : (
        <section className="section content-section cart-layout">
          <div>
            {visible.map(({ line, meal }) => (
              <div key={line.id} className="cart-line">
                <img
                  src={meal?.image || "/images/banga.jpeg"}
                  alt={meal?.title || "Unavailable meal"}
                />
                <div className="cart-line-body">
                  <h3>
                    {meal?.title || tr("Meal unavailable", "Plat indisponible")}
                  </h3>
                  <p>
                    {meal?.price != null
                      ? money(meal.price)
                      : tr("Price to be confirmed", "Prix à confirmer")}
                  </p>
                  <div className="quantity">
                    <button
                      aria-label="Decrease quantity"
                      disabled={busy}
                      onClick={() => quantity(line.id, line.quantity - 1)}
                    >
                      <Minus size={13} />
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      aria-label="Increase quantity"
                      disabled={busy}
                      onClick={() => quantity(line.id, line.quantity + 1)}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
                <button
                  className="icon-button"
                  aria-label="Remove meal"
                  disabled={busy}
                  onClick={() => quantity(line.id, 0)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <div className="cart-total">
              <span>{tr("Food total", "Total repas")}</span>
              <span>
                {quote?.total != null
                  ? money(quote.total)
                  : unpriced
                    ? tr("To be confirmed", "À confirmer")
                    : money(subtotal)}
              </span>
            </div>
            {quote?.discount != null && quote.discount > 0 && (
              <p className="form-note">
                {tr("Offer applied", "Offre appliquée")}: −
                {money(quote.discount)}
              </p>
            )}
            <div className="notice">
              {tr(
                "When prices are not displayed, your selection is a quote request. Delivery costs, where applicable, are confirmed separately.",
                "Lorsque les prix ne sont pas affichés, votre sélection est une demande de devis. Les frais de livraison sont confirmés séparément.",
              )}
            </div>
            <button
              className="underlined"
              style={{
                background: "none",
                borderTop: 0,
                borderLeft: 0,
                borderRight: 0,
              }}
              disabled={busy}
              onClick={clear}
            >
              {tr("Clear selection", "Vider la sélection")}
            </button>
          </div>
          <div className="cart-aside">
            <h2>{tr("Let’s make it happen.", "Passons à la suite.")}</h2>
            <form className="form" onSubmit={submit}>
              <fieldset className="order-fields" disabled={busy}>
                <label>
                  {tr("Your name", "Votre nom")}
                  <input
                    name="name"
                    required
                    minLength={2}
                    autoComplete="name"
                  />
                </label>
                <label>
                  {tr("Phone / WhatsApp", "Téléphone / WhatsApp")}
                  <input
                    name="phone"
                    type="tel"
                    required
                    minLength={6}
                    autoComplete="tel"
                  />
                </label>
                <label>
                  {tr(
                    "How would you like it?",
                    "Comment souhaitez-vous commander ?",
                  )}
                  <select
                    name="method"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    <option value="pickup">
                      {tr("Pickup request", "Demande à emporter")}
                    </option>
                    <option value="delivery">
                      {tr("Delivery request", "Demande de livraison")}
                    </option>
                    <option value="dine-in">
                      {tr("Dine in", "Sur place")}
                    </option>
                  </select>
                </label>
                {method === "delivery" && (
                  <label>
                    {tr("Delivery address", "Adresse de livraison")}
                    <input name="address" required maxLength={500} />
                  </label>
                )}
                <label>
                  {tr(
                    "Anything we should know?",
                    "Une précision pour notre équipe ?",
                  )}
                  <textarea
                    name="notes"
                    maxLength={1000}
                    placeholder={tr(
                      "Accompaniments, allergies, special requests…",
                      "Accompagnements, allergies, demandes particulières…",
                    )}
                  />
                </label>
                <label>
                  {tr("Your coupon (optional)", "Votre coupon (facultatif)")}
                  <input
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                    placeholder="NVO-…"
                  />
                </label>
                {coupon && (
                  <button
                    type="button"
                    className="button outline"
                    onClick={validate}
                  >
                    {tr("Check coupon", "Vérifier le coupon")}
                  </button>
                )}
                {error && (
                  <div role="alert" className="error-message">
                    {error}
                  </div>
                )}
                <button className="button" disabled={busy}>
                  {busy
                    ? tr("Preparing…", "Préparation…")
                    : tr(
                        "Prepare my WhatsApp order",
                        "Préparer ma commande WhatsApp",
                      )}
                  <ArrowUpRight size={18} />
                </button>
              </fieldset>
            </form>
          </div>
        </section>
      )}
    </>
  );
}
export function ReservationPage() {
  const { tr } = useNvo();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string; id: string } | null>(
    null,
  );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      setResult(
        await api("reservation", {
          name: f.get("name"),
          phone: f.get("phone"),
          date: f.get("date"),
          time: f.get("time"),
          guests: Number(f.get("guests")),
          message: f.get("message"),
        }),
      );
      track("reservation_clicked");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Intro
        eyebrow={tr(
          "MAKE A LITTLE TIME FOR GOOD FOOD",
          "PRENEZ LE TEMPS DE SAVOURER",
        )}
        title={tr("There’s a place for you.", "Une place vous attend.")}
        description={tr(
          "Send a table request and we’ll help you plan your NVO moment.",
          "Envoyez une demande de réservation. Notre équipe vous aidera à préparer votre moment NVO.",
        )}
      />
      <section className="section two-column">
        <div className="editorial-photo">
          <Image
            src="/images/banga.jpeg"
            alt="NVO soup and starch"
            fill
            sizes="(max-width:700px) 90vw, 40vw"
            style={{ objectFit: "cover" }}
          />
        </div>
        <div>
          {result ? (
            <div className="soft-box form">
              <h2>
                {tr("Let’s confirm your table.", "Confirmons votre table.")}
              </h2>
              <p>{result.id}</p>
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="button"
              >
                {tr("Send request on WhatsApp", "Envoyer sur WhatsApp")}
                <MessageCircle size={17} />
              </a>
            </div>
          ) : (
            <form className="form" onSubmit={submit}>
              <label>
                {tr("Your name", "Votre nom")}
                <input name="name" required minLength={2} autoComplete="name" />
              </label>
              <label>
                {tr("Phone number", "Téléphone")}
                <input
                  name="phone"
                  type="tel"
                  required
                  minLength={6}
                  autoComplete="tel"
                />
              </label>
              <div className="form-row">
                <label>
                  {tr("Date", "Date")}
                  <input
                    name="date"
                    type="date"
                    required
                    min={new Date().toISOString().slice(0, 10)}
                  />
                </label>
                <label>
                  {tr("Time", "Heure")}
                  <input name="time" type="time" required />
                </label>
              </div>
              <label>
                {tr("Your party", "Nombre de personnes")}
                <input
                  name="guests"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={2}
                  required
                />
              </label>
              <label>
                {tr("Make it special", "Une demande particulière ?")}
                <textarea name="message" maxLength={1000} />
              </label>
              {error && (
                <div className="error-message" role="alert">
                  {error}
                </div>
              )}
              <button className="button" disabled={busy}>
                {busy
                  ? tr("Preparing…", "Préparation…")
                  : tr("Request a table", "Demander une table")}
                <ArrowUpRight size={17} />
              </button>
              <p className="form-note">
                {tr(
                  "Your table is reserved only after confirmation from NVO. All times are local to Cotonou.",
                  "Votre table sera réservée après confirmation de NVO. Les heures sont celles de Cotonou.",
                )}
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
export function ContactPage() {
  const { data, tr } = useNvo();
  const s = data.settings;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const embed = key
    ? `https://www.google.com/maps/embed/v1/place?key=${key}&q=${s.latitude},${s.longitude}`
    : `https://maps.google.com/maps?q=${s.latitude},${s.longitude}&z=18&output=embed`;
  return (
    <>
      <Intro
        eyebrow={tr(
          "A GOOD MEAL IS CLOSER THAN YOU THINK",
          "LE BONHEUR EST TOUT PRÈS",
        )}
        title={tr("Find your way to NVO.", "Retrouvez-nous chez NVO.")}
        description={s.address}
      />
      <section className="section content-section">
        <div className="two-column">
          <div className="prose">
            <h2>
              {tr("Come hungry.", "Venez avec appétit.")}{" "}
              <em>{tr("Leave happy.", "Repartez heureux.")}</em>
            </h2>
            <p>
              {tr(
                "Planning a meal, a catch-up, or your next order? Our team is a WhatsApp message away.",
                "Un repas, des retrouvailles ou votre prochaine commande ? Notre équipe est à un message WhatsApp.",
              )}
            </p>
            <a
              className="button"
              href={`https://wa.me/${s.whatsapp}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={18} />
              {tr("Chat with NVO", "Discuter avec NVO")}
            </a>
          </div>
          <div className="contact-list">
            <div>
              <MapPin />
              <span>
                <strong>{tr("Our address", "Notre adresse")}</strong>
                <p>{s.address}</p>
                <a
                  className="underlined"
                  href={s.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track("directions_clicked")}
                >
                  {tr("Open Google Maps", "Ouvrir Google Maps")}
                  <ArrowUpRight size={16} />
                </a>
              </span>
            </div>
            <div>
              <MessageCircle />
              <span>
                <strong>WhatsApp</strong>
                <p>+{s.whatsapp}</p>
              </span>
            </div>
            <div>
              <Clock />
              <span>
                <strong>{tr("Before you visit", "Avant votre visite")}</strong>
                <p>
                  {s.hours ||
                    tr(
                      "Please contact us for today’s opening and kitchen hours.",
                      "Contactez-nous pour les horaires d’ouverture et de cuisine du jour.",
                    )}
                </p>
              </span>
            </div>
          </div>
        </div>
        <iframe
          className="map-frame"
          title="NVO Restaurant location, Agblangandan"
          src={embed}
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <p className="form-note">
          {tr(
            "Location from the restaurant’s shared Google Maps pin.",
            "Emplacement fourni par le lien Google Maps du restaurant.",
          )}
        </p>
      </section>
    </>
  );
}
export function AboutPage() {
  const { tr } = useNvo();
  return (
    <>
      <Intro
        eyebrow="THE NVO WAY"
        title={tr("Food brings us together.", "Les saveurs nous rassemblent.")}
        description={tr(
          "Seafood, Nigerian favourites and a warm welcome in Cotonou.",
          "Fruits de mer, spécialités nigérianes et accueil chaleureux à Cotonou.",
        )}
      />
      <section className="section two-column">
        <div className="editorial-photo">
          <Image
            src="/images/fish-rice.jpeg"
            alt="Rice prepared at NVO"
            fill
            sizes="(max-width:700px) 90vw, 40vw"
            style={{ objectFit: "cover" }}
          />
        </div>
        <div className="prose">
          <span className="eyebrow">A LITTLE TASTE OF HOME</span>
          <h2>
            {tr("Familiar flavours.", "Des saveurs familières.")}
            <br />
            <em>{tr("New memories.", "De nouveaux souvenirs.")}</em>
          </h2>
          <p>
            {tr(
              "NVO brings seafood and Nigerian favourites to Agblangandan, Cotonou. From banga soup and swallow to rice, fish and plantain, our menu celebrates the meals you look forward to.",
              "NVO réunit les fruits de mer et les spécialités nigérianes à Agblangandan, Cotonou. De la soupe Banga au riz, poisson et plantain, notre carte célèbre les plats que vous aimez.",
            )}
          </p>
          <p>
            {tr(
              "Find a familiar favourite, try something different, and share a good moment with your people. Order with our team on WhatsApp or ask us about a table for your next visit.",
              "Retrouvez vos incontournables, découvrez une nouvelle saveur et partagez un bon moment. Commandez avec notre équipe sur WhatsApp ou demandez une table pour votre prochaine visite.",
            )}
          </p>
          <Link className="button" href="/menu">
            {tr("Find your favourite", "Trouvez votre coup de cœur")}
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}
export function GalleryPage() {
  const { tr } = useNvo();
  return (
    <>
      <Intro
        eyebrow="A LITTLE NVO IN EVERY FRAME"
        title={tr("Feast your eyes.", "Le plaisir commence ici.")}
        description={tr(
          "A few delicious moments from the NVO kitchen.",
          "Quelques moments gourmands de la cuisine NVO.",
        )}
      />
      <section className="section gallery-grid">
        {[
          "banga.jpeg",
          "rice-fish.jpeg",
          "soup.jpeg",
          "fish-rice.jpeg",
          "banga-detail.webp",
          "peppered-bites.webp",
        ].map((n) => (
          <div key={n}>
            <Image
              src={`/images/${n}`}
              alt={`NVO ${n.split(".")[0].replaceAll("-", " ")}`}
              fill
              sizes="(max-width:700px) 45vw, 30vw"
              style={{ objectFit: "cover" }}
            />
          </div>
        ))}
      </section>
      <KitchenFilm />
      <section className="section archive-flyers">
        <span className="eyebrow">NVO IN COLOUR</span>
        <h2>{tr("From the NVO scrapbook.", "Le carnet de NVO.")}</h2>
        <p>
          {tr(
            "A few of our supplied campaign designs. These are archived brand visuals; current dishes and order details are available from our team.",
            "Quelques créations de nos campagnes, conservées dans nos archives. Confirmez les plats et les détails de commande auprès de notre équipe.",
          )}
        </p>
        <div className="flyer-grid">
          {[
            ["nvo-oclock", "It’s NVO o’clock"],
            ["rice-flyer", "Rice favourites"],
            ["vegetable-flyer", "Vegetable soup"],
          ].map(([file, caption]) => (
            <figure key={file}>
              <Image
                src={`/images/${file}.webp`}
                alt={`Archived NVO promotion: ${caption}`}
                width={600}
                height={750}
                style={{ height: "auto" }}
              />
              <figcaption>
                {caption} · {tr("Brand archive", "Archives de marque")}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </>
  );
}
export function OffersPage() {
  return <OffersExperience />;
}
export function ReferralPage({ code }: { code?: string }) {
  const { tr, data } = useNvo();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [visit, setVisit] = useState<{
    expiresAt: string;
    campaignId: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [claimed, setClaimed] = useState(false);
  const [claimant, setClaimant] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function act() {
    setBusy(true);
    setError("");
    try {
      if (code) {
        if (!visit) setVisit(await api("referral/visit", { code }));
        else {
          await api("claim", {
            campaignId: visit.campaignId,
            referralId: code,
            name: claimant,
          });
          setClaimed(true);
        }
      } else {
        const r = await api("referral", {});
        setUrl(location.origin + "/r/" + r.code);
        track("referral_shared");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Intro
        eyebrow={tr("GOOD TASTE RUNS IN YOUR CIRCLE", "LE BON GOÛT SE PARTAGE")}
        title={tr(
          "Bring a friend to the table.",
          "Invitez un ami à notre table.",
        )}
        description={tr(
          "Share a little NVO with someone who loves good food as much as you do.",
          "Partagez NVO avec quelqu’un qui aime les bons plats autant que vous.",
        )}
      />
      <section className="section" style={{ maxWidth: 750 }}>
        {!data.settings.referralEnabled ? (
          <Empty
            title={tr("More good things to come.", "De belles choses à venir.")}
            text={tr(
              "Our referral programme is not active right now. You can still share the menu with a friend.",
              "Notre programme de parrainage n’est pas actif actuellement. Vous pouvez toujours partager la carte avec un ami.",
            )}
          />
        ) : (
          <div className="reward-card">
            <Users size={30} />
            <h3>
              {code
                ? tr("Your friend has good taste.", "Votre ami a bon goût.")
                : tr(
                    "A good meal is worth sharing.",
                    "Un bon repas mérite d’être partagé.",
                  )}
            </h3>
            {visit && (
              <p>
                {tr("Time left to claim", "Temps restant")}:{" "}
                {Math.max(
                  0,
                  Math.floor((Date.parse(visit.expiresAt) - now) / 60000),
                )}
                :
                {String(
                  Math.max(
                    0,
                    Math.floor((Date.parse(visit.expiresAt) - now) / 1000) % 60,
                  ),
                ).padStart(2, "0")}
              </p>
            )}
            {visit && !claimed && (
              <label>
                Your name / Votre nom
                <input
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                  value={claimant}
                  onChange={(ev) => setClaimant(ev.target.value)}
                />
              </label>
            )}
            {claimed ? (
              <Link className="button" href="/offers">
                {tr("View your reward", "Voir votre récompense")}
              </Link>
            ) : url ? (
              <>
                <code style={{ fontSize: 12, overflowWrap: "anywhere" }}>
                  {url}
                </code>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent("Join me at NVO! " + url)}`}
                  className="button"
                  target="_blank"
                  rel="noreferrer"
                >
                  {tr("Share on WhatsApp", "Partager sur WhatsApp")}
                  <ArrowUpRight size={17} />
                </a>
              </>
            ) : (
              <button className="button" disabled={busy} onClick={act}>
                {busy
                  ? "…"
                  : code
                    ? visit
                      ? tr("Claim my offer", "Réclamer mon offre")
                      : tr("Open my invitation", "Ouvrir mon invitation")
                    : tr("Create my invitation", "Créer mon invitation")}
                <ArrowUpRight size={17} />
              </button>
            )}
            {error && (
              <p className="error-message" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </section>
    </>
  );
}
export function ContentPage({
  kind,
  id,
}: {
  kind: "posts" | "events" | "loyalty" | "testimonials";
  id?: string;
}) {
  const { data, tr, lang } = useNvo();
  const all = data.entries.filter((e) => e.kind === kind);
  const item = id ? all.find((e) => e.id === id) : null;
  const labels = {
    posts: [
      tr("The NVO journal.", "Le journal NVO."),
      tr(
        "Fresh stories, familiar flavours and little reasons to visit.",
        "Des nouvelles, des saveurs et de belles raisons de venir.",
      ),
    ],
    events: [
      tr(
        "Make a little room for good times.",
        "Faites place aux bons moments.",
      ),
      tr(
        "See what’s coming up at NVO.",
        "Découvrez les prochains événements chez NVO.",
      ),
    ],
    loyalty: [
      tr("The people who make NVO.", "Ceux qui font vivre NVO."),
      tr(
        "A little appreciation for our community and the moments we share.",
        "Un peu de reconnaissance pour notre communauté et nos moments partagés.",
      ),
    ],
    testimonials: [
      tr("Good food. Real stories.", "De bons plats. De vraies histoires."),
      tr(
        "Experiences shared by our guests.",
        "Les expériences de nos clients.",
      ),
    ],
  };
  if (item)
    return (
      <>
        <Intro
          eyebrow="NVO JOURNAL"
          title={lang === "fr" ? item.titleFr || item.title : item.title}
        />
        <article className="section legal prose">
          {item.demo && (
            <>
              <SampleBadge />
              <p className="sample-disclosure">
                {tr(
                  "Design preview: this is sample editorial content for review, not a confirmed event or offer.",
                  "Aperçu : contenu de démonstration à valider, pas un événement ou une offre confirmée.",
                )}
              </p>
            </>
          )}
          {item.image && (
            <img
              src={item.image}
              alt={item.title}
              style={{ width: "100%", maxHeight: 550, objectFit: "cover" }}
            />
          )}
          {item.date && <p>{new Date(item.date).toLocaleString()}</p>}
          <p style={{ whiteSpace: "pre-line" }}>
            {lang === "fr"
              ? item.descriptionFr || item.description
              : item.description}
          </p>
          {kind === "events" && (
            <Link className="button" href="/reservation">
              {tr("Ask about this event", "Se renseigner")}
              <ArrowUpRight size={17} />
            </Link>
          )}
        </article>
      </>
    );
  return (
    <>
      <Intro
        eyebrow="THE NVO COMMUNITY"
        title={labels[kind][0]}
        description={labels[kind][1]}
      />
      <section className="section content-section">
        {all.length ? (
          <div className="journal-grid">
            {all.map((e) => (
              <article className="post-card" key={e.id}>
                {e.image && <img src={e.image} alt={e.title} />}
                {e.demo && <SampleBadge />}
                <h3>{lang === "fr" ? e.titleFr || e.title : e.title}</h3>
                <p>
                  {
                    (lang === "fr"
                      ? e.descriptionFr || e.description
                      : e.description
                    ).split("\n")[0]
                  }
                </p>
                {["posts", "events"].includes(kind) && (
                  <Link
                    className="underlined"
                    href={`/${kind === "posts" ? "news" : "events"}/${e.id}`}
                  >
                    {tr("Read more", "En savoir plus")}
                    <ArrowUpRight size={16} />
                  </Link>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty
            icon="calendar"
            title={tr(
              "Our next chapter is on its way.",
              "La suite s’écrit bientôt.",
            )}
            text={
              kind === "events"
                ? tr(
                    "No upcoming events have been announced. Get in touch to plan your own NVO moment.",
                    "Aucun événement annoncé pour le moment. Contactez-nous pour organiser votre moment NVO.",
                  )
                : tr(
                    "We’ll share updates here when they’re ready. In the meantime, explore something delicious.",
                    "Nous partagerons les nouvelles ici. En attendant, découvrez nos plats.",
                  )
            }
          />
        )}
      </section>
    </>
  );
}
export function LegalPage({ privacy }: { privacy: boolean }) {
  const { tr } = useNvo();
  return (
    <>
      <Intro
        eyebrow="NVO RESTAURANT"
        title={
          privacy
            ? tr("Your privacy matters.", "Votre vie privée compte.")
            : tr("A few things to know.", "Quelques informations utiles.")
        }
      />
      <article className="section legal prose">
        {privacy ? (
          <>
            <h2>
              {tr("Your orders and requests", "Vos commandes et demandes")}
            </h2>
            <p>
              {tr(
                "We use the name, contact details and information you submit to manage your order or reservation request. When you continue to WhatsApp, the message is shared with WhatsApp and NVO under that service’s own terms.",
                "Nous utilisons les coordonnées et informations que vous transmettez pour gérer votre demande de commande ou de réservation. En continuant vers WhatsApp, le message est partagé avec WhatsApp et NVO selon les conditions de ce service.",
              )}
            </p>
            <h2>{tr("WhatsApp subscriptions", "Abonnements WhatsApp")}</h2>
            <p>
              {tr(
                "For coupons, NVO records your name, claim date, unique code, download request and redemption. A protected hash of your IP address enforces one claim per offer per network; raw IP addresses are not stored in the coupon database. Shared Wi-Fi counts as one network. Keep your downloaded card to present it to staff.",
                "Pour les coupons, NVO enregistre votre nom, la date, le code unique, la demande de téléchargement et l’utilisation. Une empreinte protégée de votre adresse IP limite chaque offre à une obtention par réseau ; l’adresse IP brute n’est pas conservée dans la base des coupons. Un Wi-Fi partagé compte comme un seul réseau. Conservez votre carte téléchargée pour la présenter à l’équipe.",
              )}
            </p>
            <p>
              {tr(
                "If you send JOIN NVO or ABONNER NVO to our connected WhatsApp business number, we store your number, profile name, consent record and delivery results to send restaurant news and offers through Meta's WhatsApp service. Ordering food does not subscribe you. Reply STOP to stop future promotional messages; we keep your unsubscribe preference so you are not added again without a new subscription. Contact NVO to request access, correction or removal of your subscription information.",
                "Si vous envoyez JOIN NVO ou ABONNER NVO à notre numéro WhatsApp professionnel connecté, nous enregistrons votre numéro, votre nom de profil, votre consentement et les résultats d’envoi afin de vous transmettre nos offres et nouvelles via le service WhatsApp de Meta. Commander ne vous abonne pas. Répondez STOP pour arrêter les messages promotionnels ; nous conservons ce choix pour éviter une réinscription sans votre accord. Contactez NVO pour consulter, corriger ou supprimer vos informations d’abonnement.",
              )}
            </p>
            <h2>
              {tr(
                "Storage and optional analytics",
                "Stockage et statistiques facultatives",
              )}
            </h2>
            <p>
              {tr(
                "Your cart and language preference are stored in this browser. The latest order’s WhatsApp link is kept in this tab for up to 24 hours so you can finish sending it. An essential cookie associates offers with your browser; a secure session cookie is used for staff login. A staff-browser marker excludes internal visits from guest counts. After consent, optional analytics measure public page views and cart changes using a browser identifier and visits separated by 30 minutes of inactivity. Browser counts are not a count of individual people. Maps and social links connect to external services.",
                "Votre panier et votre langue sont enregistrés dans ce navigateur. Le lien WhatsApp de la dernière commande reste dans cet onglet pendant 24 heures au maximum pour vous permettre de l’envoyer. Un cookie essentiel associe les offres à votre navigateur ; un cookie sécurisé permet la connexion du personnel. Un marqueur exclut les visites internes des statistiques clients. Avec votre accord, les statistiques mesurent les pages vues et les changements du panier via un identifiant de navigateur ; une visite se termine après 30 minutes d’inactivité. Ces identifiants ne représentent pas des personnes distinctes. Les cartes et réseaux sociaux sont des services externes.",
              )}
            </p>
            <button
              className="button outline"
              onClick={() => {
                localStorage.setItem("nvo-analytics", "no");
                location.reload();
              }}
            >
              {tr(
                "Disable optional analytics",
                "Désactiver les statistiques facultatives",
              )}
            </button>
            <h2>{tr("Contact us", "Contactez-nous")}</h2>
            <p>
              {tr(
                "Contact NVO through our contact page to ask about your information or request its correction or removal.",
                "Contactez NVO via notre page de contact pour toute demande concernant vos données, leur correction ou leur suppression.",
              )}
            </p>
          </>
        ) : (
          <>
            <h2>{tr("Order confirmation", "Confirmation de commande")}</h2>
            <p>
              {tr(
                "A website selection, request or WhatsApp click is not a confirmed order or payment. Our team confirms meal availability, portions, pricing, delivery and reservations directly.",
                "Une sélection, une demande ou un clic WhatsApp ne constitue pas une commande confirmée ni un paiement. Notre équipe confirme les disponibilités, portions, prix, livraison et réservations directement.",
              )}
            </p>
            <h2>{tr("Offers and saved coupons", "Offres et coupons")}</h2>
            <p>
              {tr(
                "Each offer has its own claim period, activation date and redemption conditions. A saved card does not override expiry, eligibility or redemption checks. Show your code to NVO before confirming your order.",
                "Chaque offre possède ses propres dates et conditions. Une carte enregistrée ne remplace pas les vérifications de validité, d’éligibilité et d’utilisation. Présentez votre code avant de confirmer votre commande.",
              )}
            </p>
            <h2>{tr("Food preferences", "Préférences alimentaires")}</h2>
            <p>
              {tr(
                "Please tell the team about allergies and dietary needs before ordering. Photography is illustrative of the restaurant’s food; ask about current portions and accompaniments.",
                "Informez notre équipe des allergies et besoins alimentaires avant de commander. Les photos illustrent la cuisine du restaurant ; demandez les portions et accompagnements disponibles.",
              )}
            </p>
          </>
        )}
        <Link className="underlined" href="/contact">
          {tr("Contact NVO", "Contacter NVO")}
          <ArrowUpRight size={16} />
        </Link>
      </article>
    </>
  );
}
