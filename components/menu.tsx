"use client";
import { useState } from "react";
import Image from "next/image";
import {
  ArrowUpRight,
  Search,
  Plus,
  UtensilsCrossed,
  Clock,
  Fish,
  X,
} from "lucide-react";
import Link from "./locale-link";
import { useNvo } from "./provider";
import { money } from "@/lib/catalog";
import { entryText } from "@/lib/i18n";
import { menuPhotos, photoCredit } from "@/lib/menu-photos";
import type { Entry } from "@/lib/types";

export function PhotoCredit({ image }: { image?: string }) {
  const { tr } = useNvo();
  const credit = photoCredit(image);
  if (!credit) return null;
  return (
    <p className="menu-photo-credit">
      {tr(
        "Illustrative photo; NVO’s presentation may differ.",
        "Photo illustrative ; la présentation chez NVO peut varier.",
      )}{" "}
      <a href={credit.source} target="_blank" rel="noreferrer">
        {credit.author}
      </a>{" "}
      ·{" "}
      <a href={credit.licenseUrl} target="_blank" rel="noreferrer">
        {credit.license}
      </a>
      . {tr("Resized and compressed.", "Redimensionnée et compressée.")}
    </p>
  );
}
export function MenuItem({ meal }: { meal: Entry }) {
  const { lang, tr, add } = useNvo();
  const text = entryText(meal, lang);
  const illustrative = photoCredit(meal.image);
  return (
    <article className="menu-line" data-menu-item={meal.id}>
      <Link
        className="menu-line-photo"
        href={`/menu/${meal.id}`}
        aria-label={text.title}
      >
        {meal.image ? (
          <Image
            src={meal.image}
            alt={
              illustrative
                ? tr(
                    `Illustration: ${illustrative.en}`,
                    `Illustration : ${illustrative.fr}`,
                  )
                : text.title
            }
            fill
            sizes="88px"
            quality={60}
            style={{ objectFit: "cover" }}
          />
        ) : (
          <UtensilsCrossed size={24} strokeWidth={1.1} aria-hidden="true" />
        )}
        {illustrative && <span>{tr("Illustration", "Illustration")}</span>}
      </Link>
      <div className="menu-line-copy">
        {meal.preorder && (
          <span className="menu-preorder">
            <Clock size={12} aria-hidden="true" />
            {tr("Pre-order", "Sur commande")}
          </span>
        )}
        <h3>
          <Link href={`/menu/${meal.id}`}>{text.title}</Link>
        </h3>
        <p>{text.description}</p>
        <span className="menu-line-price">
          {meal.price != null
            ? money(meal.price)
            : tr(
                "Price confirmed by our team",
                "Prix à confirmer avec notre équipe",
              )}
        </span>
      </div>
      <button
        className="menu-add"
        type="button"
        disabled={meal.available === false}
        onClick={() => add(meal.id)}
        aria-label={
          meal.available === false
            ? `${text.title} — ${tr("unavailable", "indisponible")}`
            : tr("Add ", "Ajouter ") + text.title
        }
      >
        <Plus size={19} aria-hidden="true" />
      </button>
    </article>
  );
}
const searchable = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function CurrentMenu() {
  const { data, tr, lang } = useNvo();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const allMeals = data.entries.filter((e) => e.kind === "meals");
  const categories = data.entries.filter(
    (e) => e.kind === "categories" && allMeals.some((m) => m.category === e.id),
  );
  const query = searchable(search.trim());
  const meals = allMeals.filter(
    (e) =>
      (category === "all" || e.category === category) &&
      searchable(
        `${e.title} ${e.titleFr || ""} ${e.description} ${e.descriptionFr || ""}`,
      ).includes(query),
  );
  const sections = [
    ...categories,
    ...(allMeals.some((m) => !m.category)
      ? [
          {
            id: "",
            title: "Other favourites",
            titleFr: "Autres spécialités",
            description: "",
          },
        ]
      : []),
  ];
  return (
    <>
      <section className="menu-hero">
        <div className="menu-hero-copy">
          <span className="eyebrow">NVO RESTAURANT · COTONOU</span>
          <h1>
            {tr("A menu made", "Une carte faite")}
            <br />
            <em>{tr("for your cravings.", "pour vos envies.")}</em>
          </h1>
          <p>
            {tr(
              "Jollof rice, Nigerian soups, shawarma and seafood feasts. Explore our full menu, make your selection and let our team take care of you.",
              "Riz jollof, soupes nigérianes, shawarmas et festins de fruits de mer. Découvrez toute notre carte, faites votre choix et laissez notre équipe vous accueillir.",
            )}
          </p>
          <a className="button gold-button" href="#menu-categories">
            {tr("Find your favourite", "Trouvez votre coup de cœur")}
            <ArrowUpRight size={18} />
          </a>
        </div>
        <div className="menu-hero-photo">
          <Image
            src="/images/banga-detail.webp"
            alt={tr("NVO soup and starch", "Soupe et starch de NVO")}
            fill
            sizes="(max-width:700px) 72vw, (min-width:1280px) 465px, 42vw"
            priority
            quality={60}
            style={{ objectFit: "cover" }}
          />
          <span className="menu-hero-seal">
            <Fish size={22} />
            {tr(
              "Nigerian soul.\nSeafood heart.",
              "Âme nigériane.\nCœur marin.",
            )}
          </span>
        </div>
      </section>
      <section
        className="section menu-experience"
        id="menu-categories"
        aria-label={tr("Restaurant menu", "Carte du restaurant")}
      >
        <div className="menu-toolbar">
          <div>
            <span className="eyebrow">
              {tr("THE FULL NVO MENU", "TOUTE LA CARTE NVO")}
            </span>
            <h2>{tr("What are you craving?", "De quoi avez-vous envie ?")}</h2>
          </div>
          <label className="menu-search">
            <Search size={19} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={tr("Search menu", "Rechercher dans la carte")}
              placeholder={tr("Rice, soup, shawarma…", "Riz, soupe, shawarma…")}
            />
            {search && (
              <button
                aria-label={tr("Clear search", "Effacer la recherche")}
                onClick={() => setSearch("")}
              >
                <X size={16} />
              </button>
            )}
          </label>
        </div>
        <div className="menu-layout">
          <nav
            className="menu-categories"
            aria-label={tr("Menu categories", "Catégories de la carte")}
          >
            <button
              aria-pressed={category === "all"}
              onClick={() => setCategory("all")}
            >
              {tr("All the menu", "Toute la carte")}
              <span>{allMeals.length}</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
              >
                {entryText(c, lang).title}
                <span>
                  {allMeals.filter((m) => m.category === c.id).length}
                </span>
              </button>
            ))}
          </nav>
          <div className="menu-sections">
            <p className="menu-result-count" role="status">
              {meals.length}{" "}
              {tr("choices for your table", "choix pour votre table")}
            </p>
            {sections.map((c) => {
              const group = meals.filter((m) => (m.category || "") === c.id);
              return group.length ? (
                <section
                  className="menu-category-section"
                  key={c.id || "other"}
                  aria-labelledby={`category-${c.id || "other"}`}
                >
                  <div className="menu-section-heading">
                    <h2 id={`category-${c.id || "other"}`}>
                      {entryText(c, lang).title}
                    </h2>
                    <span>{String(group.length).padStart(2, "0")}</span>
                  </div>
                  <div className="menu-lines">
                    {group.map((meal) => (
                      <MenuItem key={meal.id} meal={meal} />
                    ))}
                  </div>
                </section>
              ) : null;
            })}
            {!meals.length && (
              <div className="empty">
                <Search size={28} />
                <h2>{tr("A different craving?", "Une autre envie ?")}</h2>
                <p>
                  {tr(
                    "Try another dish or see the full menu.",
                    "Essayez un autre plat ou consultez toute la carte.",
                  )}
                </p>
                <button
                  className="button"
                  onClick={() => {
                    setSearch("");
                    setCategory("all");
                  }}
                >
                  {tr("Show all dishes", "Voir tous les plats")}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="menu-order-note">
          <Clock size={22} />
          <p>
            {tr(
              "Pre-order dishes need advance confirmation. For options without a listed portion or price, our team confirms the details before you pay. Please mention allergies when ordering.",
              "Les plats sur commande nécessitent une confirmation préalable. Notre équipe confirme les portions et les prix non précisés avant tout paiement. Signalez vos allergies lors de la commande.",
            )}
          </p>
          <Link href="/contact">
            {tr("Talk to our team", "Contactez notre équipe")}
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <details className="menu-credits">
          <summary>
            {tr(
              "About the menu photographs",
              "À propos des photos de la carte",
            )}
          </summary>
          <p>
            {tr(
              "Images marked “Illustration” show the type of dish, rather than an exact NVO serving. Photos are resized and compressed for faster loading.",
              "Les images marquées « Illustration » présentent le type de plat ; la présentation chez NVO peut varier. Les photos sont redimensionnées et compressées pour un chargement rapide.",
            )}
          </p>
          {menuPhotos.map((photo) => (
            <p key={photo.image}>
              <a href={photo.source} target="_blank" rel="noreferrer">
                {photo.author} — {lang === "fr" ? photo.fr : photo.en}
              </a>{" "}
              ·{" "}
              <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
                {photo.license}
              </a>
            </p>
          ))}
        </details>
      </section>
    </>
  );
}
