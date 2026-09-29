"use client";
import Image from "next/image";
import Link from "./locale-link";
import { Plus, ArrowUpRight, UtensilsCrossed } from "lucide-react";
import { photoCredit } from "@/lib/menu-photos";
import { PhotoCredit } from "./menu";
import { useNvo } from "./provider";
import { money } from "@/lib/catalog";
import type { Entry } from "@/lib/types";
export function MealCard({ meal, index = 0 }: { meal: Entry; index?: number }) {
  const { tr, lang, add } = useNvo();
  return (
    <article className="meal-card">
      <Link className="meal-photo" href={"/menu/" + meal.id}>
        {meal.image ? (
          <Image
            src={meal.image}
            alt={lang === "fr" ? meal.titleFr || meal.title : meal.title}
            fill
            quality={60}
            sizes="(max-width:600px) 90vw, (max-width:1000px) 45vw, 30vw"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <span className="meal-photo-placeholder">
            <UtensilsCrossed size={40} strokeWidth={1} />
            NVO RESTAURANT
          </span>
        )}
        {photoCredit(meal.image) && (
          <span className="meal-illustration-label">
            {tr("Illustrative photo", "Photo illustrative")}
          </span>
        )}
        {meal.badge && <span className="photo-badge">{meal.badge}</span>}
        <span className="photo-index">
          {String(index + 1).padStart(2, "0")}
        </span>
      </Link>
      <div className="meal-info">
        <div>
          <span className="eyebrow">
            {tr("FROM OUR KITCHEN", "DE NOTRE CUISINE")}
          </span>
          <h3>
            <Link href={"/menu/" + meal.id}>
              {lang === "fr" ? meal.titleFr || meal.title : meal.title}
            </Link>
          </h3>
          <p>
            {lang === "fr"
              ? meal.descriptionFr || meal.description
              : meal.description}
          </p>
        </div>
        <div className="meal-bottom">
          <span>
            {meal.price != null
              ? money(meal.price)
              : tr("Made for your cravings", "Pour vos envies gourmandes")}
          </span>
          <button
            disabled={meal.available === false}
            onClick={() => add(meal.id)}
            aria-label={
              tr("Add ", "Ajouter ") +
              (lang === "fr" ? meal.titleFr || meal.title : meal.title)
            }
          >
            {meal.available === false ? (
              tr("Unavailable", "Indisponible")
            ) : (
              <Plus size={20} />
            )}
          </button>
        </div>
        <PhotoCredit image={meal.image} />
      </div>
    </article>
  );
}
