"use client";
import Link from "./locale-link";
import Image from "next/image";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Crown,
  UtensilsCrossed,
  Fish,
  Heart,
  Sparkles,
} from "lucide-react";
import { useNvo, track } from "./provider";
import { MealCard } from "./meal-card";
import { SpecialsSpotlight } from "./specials";
import { KitchenFilm, SampleBadge } from "./visuals";
export function Home() {
  const { tr, lang, data } = useNvo();
  const [heroDish, setHeroDish] = useState(0);
  const heroDishes = [
    {
      image: "/images/rice-fish.jpeg",
      en: "Rice, fish & plantain",
      fr: "Riz, poisson et plantain",
    },
    {
      image: "/images/banga-detail.webp",
      en: "A little taste of home",
      fr: "Un petit goût de chez nous",
    },
    {
      image: "/images/peppered-bites.webp",
      en: "Something to share",
      fr: "Un plaisir à partager",
    },
  ];
  const meals = data.entries
    .filter((e) => e.kind === "meals" && e.featured)
    .slice(0, 3);
  const posts = data.entries.filter((e) => e.kind === "posts").slice(0, 3);
  const events = data.entries.filter((e) => e.kind === "events").slice(0, 2);
  const title = (e: (typeof data.entries)[number]) =>
    lang === "fr" ? e.titleFr || e.title : e.title;
  const desc = (e: (typeof data.entries)[number]) =>
    lang === "fr" ? e.descriptionFr || e.description : e.description;
  return (
    <>
      <section className="royal-hero">
        <div className="hero-flourish" aria-hidden="true">
          ✦
        </div>
        <div className="royal-hero-copy">
          <span className="eyebrow">
            <span className="gold-line" /> NVO RESTAURANT & BAR · COTONOU
          </span>
          <h1>
            {tr("A royal welcome.", "Un accueil royal.")}
            <br />
            <em>{tr("An unforgettable", "Des saveurs")}</em>
            <br />
            {tr("taste.", "inoubliables.")}
          </h1>
          <p>
            {tr(
              "Rich Nigerian flavours. Beautiful seafood. The kind of food that brings everyone to the table. Welcome to your little taste of home.",
              "Des saveurs nigérianes généreuses. Des fruits de mer gourmands. Une cuisine qui rassemble. Bienvenue chez vous, chez NVO.",
            )}
          </p>
          <div className="hero-buttons">
            <Link className="button gold-button" href="/menu">
              {tr("Discover the menu", "Découvrir la carte")}
              <ArrowUpRight size={18} />
            </Link>
            <Link className="royal-text-link" href="/reservation">
              {tr("A table for you", "Une table pour vous")}{" "}
              <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-signature">
            <Crown size={22} strokeWidth={1.3} />
            <span>
              {tr(
                "GOOD FOOD. GREAT COMPANY. ALWAYS NVO.",
                "DE BONS PLATS. VOS PROCHES. TOUJOURS NVO.",
              )}
            </span>
          </div>
        </div>
        <div className="royal-hero-art">
          <div className="hero-orbit" aria-hidden="true" />
          <div className="hero-orbit orbit-two" aria-hidden="true" />
          <div className="royal-main-photo">
            <Image
              key={heroDish}
              src={heroDishes[heroDish].image}
              alt={tr(heroDishes[heroDish].en, heroDishes[heroDish].fr)}
              fill
              priority={heroDish === 0}
              fetchPriority={heroDish === 0 ? "high" : "auto"}
              quality={60}
              sizes="(max-width: 700px) 72vw, 43vw"
              style={{ objectFit: "cover" }}
            />
          </div>
          <svg
            className="kitchen-steam"
            aria-hidden="true"
            viewBox="0 0 130 150"
          >
            <path d="M28 145C-3 102 56 80 29 20" />
            <path d="M68 150C35 103 95 67 66 3" />
            <path d="M105 138C79 100 126 63 107 24" />
          </svg>
          <div className="royal-side-photo">
            <Image
              src="/images/banga-detail.webp"
              alt={tr(
                "Rich soup and golden starch from the NVO kitchen",
                "Soupe généreuse et starch doré de la cuisine NVO",
              )}
              fill
              sizes="(max-width:700px) 35vw, 18vw"
              style={{ objectFit: "cover" }}
            />
          </div>
          <div className="royal-seal">
            <Crown size={23} />
            <span>
              A TASTE
              <br />
              OF NVO
            </span>
            <span className="seal-stars">✦ ✦ ✦</span>
          </div>
          <span className="art-caption">
            {tr(
              "A little more flavour. A little more joy.",
              "Plus de saveurs. Plus de bonheur.",
            )}
          </span>
          <div
            className="taste-switcher"
            role="group"
            aria-label={tr("Choose a taste of NVO", "Choisir une saveur NVO")}
          >
            {heroDishes.map((dish, index) => (
              <button
                key={dish.image}
                aria-pressed={heroDish === index}
                onClick={() => setHeroDish(index)}
              >
                <span className="taste-dot" />
                {tr(dish.en, dish.fr)}
              </button>
            ))}
          </div>
        </div>
        <div className="hero-bottom">
          <span>
            <MapPin size={14} /> AGBLANGANDAN, COTONOU
          </span>
          <Link href="#at-the-table">
            {tr("Let your cravings lead the way", "Laissez parler vos envies")}{" "}
            ↓
          </Link>
        </div>
      </section>
      <div
        className="royal-ribbon"
        aria-label={tr("NVO flavours", "Les saveurs NVO")}
      >
        {[
          tr("Nigerian soul", "L’âme nigériane"),
          tr("Seafood love", "L’amour des fruits de mer"),
          tr("Cotonou heart", "Le cœur de Cotonou"),
          tr("The NVO touch", "La touche NVO"),
        ].map((t) => (
          <span key={t}>
            {t}
            <i aria-hidden="true">✦</i>
          </span>
        ))}
      </div>
      <SpecialsSpotlight />
      <section className="section royal-favourites" id="at-the-table">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {tr("THE CRAVINGS START HERE", "LE PLAISIR COMMENCE ICI")}
            </span>
            <h2>
              {tr("Made to make you", "De quoi vous faire")}
              <br />
              <em>{tr("come back.", "revenir.")}</em>
            </h2>
          </div>
          <div>
            <p>
              {tr(
                "Comforting classics, generous plates and a little something you’ll be thinking about tomorrow.",
                "Des classiques réconfortants, des assiettes généreuses et des saveurs qu’on n’oublie pas.",
              )}
            </p>
            <Link className="underlined" href="/menu">
              {tr("Explore the full menu", "Toute notre carte")}
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
        <div className="meal-grid">
          {meals.map((m, i) => (
            <MealCard key={m.id} meal={m} index={i} />
          ))}
        </div>
      </section>
      <section className="royal-story section">
        <div className="story-photo-stack">
          <div className="story-tall-photo">
            <Image
              src="/images/banga-detail.webp"
              alt="NVO soup served with golden starch"
              fill
              sizes="(max-width:700px) 65vw, 36vw"
              quality={60}
              style={{ objectFit: "cover" }}
            />
          </div>
          <div className="story-small-photo">
            <Image
              src="/images/fish-rice.jpeg"
              alt="NVO rice and fish served in a wooden bowl"
              fill
              sizes="(max-width:700px) 40vw, 20vw"
              style={{ objectFit: "cover" }}
            />
          </div>
          <span className="story-handwritten">
            {tr(
              "From our kitchen,\nwith love.",
              "De notre cuisine,\navec amour.",
            )}
          </span>
        </div>
        <div className="royal-story-copy">
          <span className="eyebrow">
            {tr("MORE THAN A MEAL", "BIEN PLUS QU’UN REPAS")}
          </span>
          <h2>
            {tr("Some places feed you.", "Certains lieux vous nourrissent.")}
            <br />
            <em>
              {tr("This one feels like home.", "Ici, vous êtes chez vous.")}
            </em>
          </h2>
          <p>
            {tr(
              "There’s something about a familiar flavour. The comfort of a rich soup. The first bite of golden plantain. A table that always has room for good conversation.",
              "Il y a le réconfort d’une saveur familière. Une soupe généreuse. Une bouchée de plantain doré. Une table où la conversation trouve toujours sa place.",
            )}
          </p>
          <p>
            {tr(
              "At NVO, seafood and Nigerian favourites meet in the heart of Agblangandan. Come for a craving, stay for a moment, and bring your people.",
              "Chez NVO, fruits de mer et spécialités nigérianes se rencontrent à Agblangandan. Venez pour une envie, restez pour un moment, avec ceux que vous aimez.",
            )}
          </p>
          <Link className="underlined" href="/about">
            {tr("A little more about us", "Un peu plus sur nous")}
            <ArrowUpRight size={17} />
          </Link>
          <div className="story-values">
            <span>
              <Fish size={23} />
              {tr("Seafood & soul", "Mer & saveurs")}
            </span>
            <span>
              <Heart size={23} />
              {tr("Made for sharing", "À partager")}
            </span>
            <span>
              <UtensilsCrossed size={23} />
              {tr("Your favourites", "Vos favoris")}
            </span>
          </div>
        </div>
      </section>
      <KitchenFilm />
      {events.length > 0 && (
        <section className="section occasion-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {tr("MAKE A MOMENT OF IT", "CRÉEZ VOTRE MOMENT")}
              </span>
              <h2>
                {tr("Good company.", "De bons moments.")}{" "}
                <em>{tr("Great plans.", "De belles idées.")}</em>
              </h2>
            </div>
            <Link className="underlined" href="/events">
              {tr("What’s on at NVO", "Les rendez-vous NVO")}
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="occasion-grid">
            {events.map((e) => (
              <Link
                href={`/events/${e.id}`}
                className="occasion-card"
                key={e.id}
              >
                <Image
                  src={e.image || "/images/rice-fish.jpeg"}
                  alt={title(e)}
                  fill
                  sizes="(max-width:700px) 90vw, 45vw"
                  style={{ objectFit: "cover" }}
                />
                <div>
                  {e.demo && <SampleBadge />}
                  <span className="eyebrow">
                    {e.badge || "AT THE NVO TABLE"}
                  </span>
                  <h3>{title(e)}</h3>
                  <span>
                    {tr("Discover the moment", "Découvrir")}{" "}
                    <ArrowUpRight size={18} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      {posts.length > 0 && (
        <section className="section royal-journal">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                {tr("NOTES FROM OUR TABLE", "LES ÉCHOS DE NOTRE TABLE")}
              </span>
              <h2>
                {tr("A taste of", "Un avant-goût de")}{" "}
                <em>{tr("the NVO life.", "la vie NVO.")}</em>
              </h2>
            </div>
            <Link className="underlined" href="/news">
              {tr("Read the journal", "Lire le journal")}
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="journal-grid">
            {posts.map((e) => (
              <article className="editorial-card" key={e.id}>
                <Link className="editorial-card-image" href={`/news/${e.id}`}>
                  <Image
                    src={e.image || "/images/banga.jpeg"}
                    alt={title(e)}
                    fill
                    sizes="(max-width:700px) 90vw, 30vw"
                    style={{ objectFit: "cover" }}
                  />
                </Link>
                <span className="eyebrow">{e.badge || "NVO JOURNAL"}</span>
                {e.demo && <SampleBadge />}
                <h3>
                  <Link href={`/news/${e.id}`}>{title(e)}</Link>
                </h3>
                <p>{desc(e).split("\n")[0].slice(0, 140)}…</p>
                <Link className="underlined" href={`/news/${e.id}`}>
                  {tr("Take a little look", "Lire la suite")}
                  <ArrowUpRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}
      <section className="royal-visit">
        <Crown size={35} strokeWidth={1} />
        <span className="eyebrow">AGBLANGANDAN · COTONOU · BÉNIN</span>
        <h2>
          {tr("Your next good memory", "Votre prochain beau souvenir")}
          <br />
          <em>{tr("starts at our table.", "commence à notre table.")}</em>
        </h2>
        <p>
          {tr(
            "Come hungry. Bring your people. We’ll take care of the flavour.",
            "Venez avec appétit et vos proches. On s’occupe des saveurs.",
          )}
        </p>
        <div className="button-row">
          <Link className="button gold-button" href="/reservation">
            {tr("Let’s make a plan", "Organisons votre visite")}
            <ArrowUpRight size={18} />
          </Link>
          <a
            className="royal-text-link"
            href={data.settings.mapsUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => track("directions_clicked")}
          >
            {tr("Find your way to NVO", "Retrouvez-nous")}
            <MapPin size={17} />
          </a>
        </div>
        <div className="visit-wordmark" aria-hidden="true">
          NVO
        </div>
      </section>
    </>
  );
}
