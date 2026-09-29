"use client";
import Link from "./locale-link";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowLeft,
  Sparkles,
  MessageCircle,
  CalendarDays,
  Gift,
} from "lucide-react";
import { useNvo, track } from "./provider";
import { SampleBadge } from "./visuals";
import type { Entry } from "@/lib/types";
import { useEffect, useState } from "react";

export function SpecialsSpotlight({
  standalone = false,
  id,
}: {
  standalone?: boolean;
  id?: string;
}) {
  const { data, lang, tr } = useNvo();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const specials = data.entries
    .filter((e) => e.kind === "specials")
    .sort(
      (a, b) =>
        Number(!!a.demo) - Number(!!b.demo) ||
        Number(!!b.featured) - Number(!!a.featured),
    );
  const special = id ? specials.find((e) => e.id === id) : specials[0];
  const title = (e: Entry) => (lang === "fr" ? e.titleFr || e.title : e.title);
  const description = (e: Entry) =>
    lang === "fr" ? e.descriptionFr || e.description : e.description;
  const date = (s: string) =>
    new Intl.DateTimeFormat(lang === "fr" ? "fr-BJ" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Porto-Novo",
    }).format(new Date(s));
  const href = special
    ? `/specials/${encodeURIComponent(special.id)}`
    : "/specials";
  const Heading = standalone ? "h1" : "h2";
  if (!special && !standalone) return null;
  return (
    <div className={standalone ? "specials-page" : "specials-home"}>
      {standalone && (
        <div className="section specials-breadcrumb">
          <Link href={id ? "/specials" : "/"}>
            <ArrowLeft size={15} />
            {id
              ? tr("All current specials", "Toutes les spécialités du moment")
              : tr("Back to NVO", "Retour à NVO")}
          </Link>
        </div>
      )}
      <section
        className="section specials-stage"
        aria-label={tr("Current specials", "Les spécialités du moment")}
      >
        <div className="specials-heading">
          <span className="eyebrow">
            <Sparkles size={16} />{" "}
            {tr("THE NVO SPOTLIGHT", "À L’HONNEUR CHEZ NVO")}
          </span>
          <span className="specials-edition">
            {tr("CURRENT SPECIALS", "SPÉCIALITÉS DU MOMENT")}
          </span>
        </div>
        {special ? (
          <article className="specials-feature">
            <div className="specials-image">
              <Image
                src={special.image || "/images/banga.jpeg"}
                alt={title(special)}
                fill
                sizes="(max-width: 760px) 94vw, 55vw"
                priority={standalone}
                style={{ objectFit: "cover" }}
              />
              <div className="specials-seal" aria-hidden="true">
                <Sparkles size={22} />
                <span>NVO</span>
                <small>{tr("THE SPOTLIGHT", "À L’HONNEUR")}</small>
              </div>
              <div className="specials-image-caption">
                <span>NVO RESTAURANT</span>
                <span>AGBLANGANDAN · COTONOU</span>
              </div>
            </div>
            <div className="specials-copy">
              {special.demo ? (
                <SampleBadge />
              ) : (
                <span className="specials-kicker">
                  {tr(
                    "A reason to come hungry.",
                    "Une raison de venir avec appétit.",
                  )}
                </span>
              )}
              <Heading>{title(special)}</Heading>
              <p className={id ? "specials-description" : "specials-excerpt"}>
                {description(special)}
              </p>
              {(special.startsAt || special.endsAt) && (
                <div className="specials-dates">
                  <CalendarDays size={17} />
                  <span>
                    {special.startsAt && (
                      <span>
                        {tr("From", "Dès le")} {date(special.startsAt)}
                      </span>
                    )}
                    {special.endsAt && (
                      <span>
                        {tr("Until", "Jusqu’au")} {date(special.endsAt)}
                      </span>
                    )}
                    <small>{tr("Cotonou time", "Heure de Cotonou")}</small>
                  </span>
                </div>
              )}
              <div className="specials-actions">
                {id && !special.demo ? (
                  <a
                    className="button gold"
                    href={`https://wa.me/${data.settings.whatsapp}?text=${encodeURIComponent(tr(`Hello NVO! I’m interested in your special: ${title(special)}. Please confirm availability and price.`, `Bonjour NVO ! Votre spécialité m’intéresse : ${title(special)}. Merci de confirmer la disponibilité et le prix.`) + "\n" + origin + href)}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => track("special_order_clicked")}
                  >
                    <MessageCircle size={18} />
                    {tr("Ask for this special", "Demander cette spécialité")}
                  </a>
                ) : (
                  <Link className="button gold" href={href}>
                    {tr("Discover this special", "Découvrir cette spécialité")}
                    <ArrowUpRight size={18} />
                  </Link>
                )}
                {!standalone && (
                  <Link className="specials-text-link" href="/specials">
                    {tr("See all current specials", "Toutes les spécialités")}{" "}
                    <ArrowUpRight size={16} />
                  </Link>
                )}
                {id && (
                  <Link className="specials-text-link" href="/menu">
                    {tr("Explore the full menu", "Explorer toute la carte")}{" "}
                    <ArrowUpRight size={16} />
                  </Link>
                )}
              </div>
              <div className="specials-footnote">
                {special.demo
                  ? tr(
                      "Preview inspiration · not an orderable special.",
                      "Aperçu d’inspiration · non disponible à la commande.",
                    )
                  : tr(
                      "Ask our team about availability, prices and dietary needs.",
                      "Notre équipe vous renseigne sur la disponibilité, les prix et les besoins alimentaires.",
                    )}
              </div>
            </div>
          </article>
        ) : (
          <div className="specials-empty">
            <Sparkles size={36} />
            <h1>
              {tr(
                "The next craving starts here.",
                "Votre prochaine envie commence ici.",
              )}
            </h1>
            <p>
              {tr(
                "Our team will share the next special here. Until then, find your favourites on the menu.",
                "Notre équipe présentera ici sa prochaine spécialité. En attendant, retrouvez vos favoris à la carte.",
              )}
            </p>
            <Link className="button gold" href="/menu">
              {tr("Explore the menu", "Découvrir la carte")}{" "}
              <ArrowUpRight size={18} />
            </Link>
          </div>
        )}
      </section>
      {standalone && specials.some((e) => e.id !== special?.id) && (
        <section className="section specials-more">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {tr("KEEP THE CRAVINGS COMING", "ENCORE PLUS DE GOURMANDISE")}
              </span>
              <h2>{tr("More in the spotlight.", "Également à l’honneur.")}</h2>
            </div>
          </div>
          <div className="specials-grid">
            {specials
              .filter((e) => e.id !== special?.id)
              .map((e) => (
                <Link
                  className="specials-card"
                  key={e.id}
                  href={`/specials/${encodeURIComponent(e.id)}`}
                >
                  <div className="specials-card-photo">
                    <Image
                      src={e.image || "/images/banga.jpeg"}
                      alt={title(e)}
                      fill
                      sizes="(max-width: 760px) 90vw, 40vw"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  <div>
                    {e.demo && <SampleBadge />}
                    <h3>{title(e)}</h3>
                    <p>{description(e)}</p>
                    <span>
                      {tr("Discover the special", "Découvrir la spécialité")}{" "}
                      <ArrowUpRight size={17} />
                    </span>
                  </div>
                </Link>
              ))}
          </div>
        </section>
      )}
      {standalone && (
        <section className="section specials-return">
          <div>
            <MessageCircle size={24} />
            <h2>
              {tr(
                "Don’t miss your next favourite.",
                "Ne manquez pas votre prochain coup de cœur.",
              )}
            </h2>
            <p>
              {tr(
                "Subscribe to NVO’s WhatsApp updates for restaurant news and specials when we publish them.",
                "Abonnez-vous aux nouvelles NVO sur WhatsApp pour découvrir nos actualités et spécialités dès leur publication.",
              )}
            </p>
            <Link className="button" href="/subscribe">
              {tr("Keep me in the loop", "Recevoir les nouvelles")}{" "}
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div>
            <Gift size={24} />
            <h3>
              {tr("A little privilege, too.", "Un petit privilège, aussi.")}
            </h3>
            <p>
              {tr(
                "Our coupon cards have a home of their own. Discover available rewards and keep your claimed cards.",
                "Nos cartes privilèges ont leur propre espace. Découvrez les coupons disponibles et retrouvez vos cartes.",
              )}
            </p>
            <Link className="underlined" href="/offers">
              {tr("Explore coupons & rewards", "Découvrir les coupons")}{" "}
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
