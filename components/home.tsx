"use client";
import Link from "./locale-link";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Utensils,
  Flame,
  Heart,
  Sparkles,
} from "lucide-react";
import { useNvo, track } from "./provider";
import { MealCard } from "./meal-card";
export function Home() {
  const { tr, data } = useNvo();
  const meals = data.entries
    .filter((e) => e.kind === "meals" && e.featured)
    .slice(0, 3);
  const special = data.entries.find((e) => e.kind === "specials");
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="gold-line" /> COTONOU’S LITTLE TASTE OF HOME
          </div>
          <h1>
            {tr("Come for the", "Venez pour le")}
            <br />
            <em>{tr("flavour.", "goût.")}</em>
            <br />
            {tr("Stay for the", "Restez pour les")}
            <br />
            <span className="outlined-word">{tr("feeling.", "moments.")}</span>
          </h1>
          <p>
            {tr(
              "Seafood, Nigerian favourites, and the joy of a really good meal. There’s a place for you at NVO.",
              "Fruits de mer, saveurs nigérianes et le plaisir d’un bon repas. Une place vous attend chez NVO.",
            )}
          </p>
          <div className="hero-buttons">
            <Link className="button" href="/menu">
              {tr("Explore our menu", "Découvrir notre carte")}
              <ArrowUpRight size={19} />
            </Link>
            <Link className="underlined" href="/reservation">
              {tr("Book a table", "Réserver une table")}
              <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-note">
            <span className="note-icon">
              <MapPin size={18} />
            </span>
            <span>
              AGBLANGANDAN, COTONOU
              <br />
              <a
                href={data.settings.mapsUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => track("directions_clicked")}
              >
                {tr(
                  "Your next delicious stop",
                  "Votre prochaine pause gourmande",
                )}{" "}
                ↗
              </a>
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-image">
            <Image
              src="/images/rice-fish.jpeg"
              alt={tr(
                "NVO rice with fish, prawns and golden plantain",
                "Riz NVO avec poisson, crevettes et plantain doré",
              )}
              fill
              priority
              sizes="(max-width: 800px) 100vw, 55vw"
              style={{ objectFit: "cover" }}
            />
            <div className="image-shade" />
            <span className="image-caption">REAL FOOD. REAL NVO.</span>
          </div>
          <div className="hero-stamp">
            <Sparkles size={20} />
            <span>
              GOOD FOOD
              <br />
              GOOD MOOD
            </span>
            <span className="stamp-small">THE NVO WAY</span>
          </div>
          <div className="floating-card">
            <span className="gold-dot" />
            <div>
              <strong>
                {tr("Your cravings, answered.", "Vos envies, comblées.")}
              </strong>
              <span>
                {tr(
                  "Fresh from our kitchen to your table",
                  "De notre cuisine à votre table",
                )}
              </span>
            </div>
            <ArrowUpRight size={22} />
          </div>
          <div className="vertical-note">SEAFOOD · SOUL FOOD · GOOD TIMES</div>
        </div>
      </section>
      <div className="ticker" aria-label="NVO favourites">
        <span>
          {tr("A little taste of home", "Un petit goût de chez vous")}
        </span>
        <span>✦</span>
        <span>{tr("Big on flavour", "Généreux en saveurs")}</span>
        <span>✦</span>
        <span>{tr("Made for good company", "À partager ensemble")}</span>
        <span>✦</span>
        <span>{tr("Always a good idea", "Toujours une bonne idée")}</span>
        <span>✦</span>
      </div>
      <section className="section favourites">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {tr(
                "THE ONES YOU’LL COME BACK FOR",
                "LES PLATS QUI FONT REVENIR",
              )}
            </span>
            <h2>
              {tr("Meet your next", "Votre prochain")}{" "}
              <em>{tr("favourite.", "coup de cœur.")}</em>
            </h2>
          </div>
          <Link className="underlined" href="/menu">
            {tr("View the full menu", "Voir toute la carte")}
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="meal-grid">
          {meals.map((m, i) => (
            <MealCard key={m.id} meal={m} index={i} />
          ))}
        </div>
      </section>
      <section className="story-section">
        <div className="story-photos">
          <div className="story-main">
            <Image
              src="/images/banga.jpeg"
              alt="Banga soup and starch at NVO"
              fill
              sizes="(max-width:800px) 85vw, 40vw"
              style={{ objectFit: "cover" }}
            />
          </div>
          <span className="story-label">
            A TASTE OF
            <br />
            <em>home.</em>
          </span>
          <div className="story-detail">
            <Image
              src="/images/fish-rice.jpeg"
              alt="NVO fish rice"
              fill
              sizes="200px"
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>
        <div className="story-copy">
          <span className="eyebrow">
            {tr("MORE THAN A MEAL", "BIEN PLUS QU’UN REPAS")}
          </span>
          <h2>
            {tr("Some places just", "Certains lieux ont")}
            <br />
            <em>{tr("feel like home.", "un goût de chez soi.")}</em>
          </h2>
          <p>
            {tr(
              "A familiar favourite. A new flavour to fall for. A table shared with people you love. That’s what a good meal is all about.",
              "Un plat familier. Une nouvelle saveur. Une table partagée avec ceux que vous aimez. Voilà ce qui rend un repas si spécial.",
            )}
          </p>
          <p>
            {tr(
              "At NVO, we bring seafood and Nigerian favourites together in Cotonou. Come with your appetite. We’ll take care of the flavour.",
              "Chez NVO, les fruits de mer rencontrent les spécialités nigérianes à Cotonou. Apportez votre appétit, nous nous occupons des saveurs.",
            )}
          </p>
          <Link href="/about" className="underlined">
            {tr("A little more about us", "Un peu plus sur nous")}
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
      <section className="values-strip">
        <div>
          <Utensils />
          <span>
            {tr("Food worth slowing down for", "Des plats à savourer")}
            <small>
              {tr(
                "Familiar favourites, NVO flavour",
                "Les incontournables, façon NVO",
              )}
            </small>
          </span>
        </div>
        <div>
          <Flame />
          <span>
            {tr(
              "A little something for every craving",
              "À chaque envie son plaisir",
            )}
            <small>
              {tr(
                "From hearty soups to seafood",
                "Des soupes généreuses aux fruits de mer",
              )}
            </small>
          </span>
        </div>
        <div>
          <Heart />
          <span>
            {tr("Better when we’re together", "Encore meilleur ensemble")}
            <small>
              {tr("Your people. Your place.", "Vos proches. Votre adresse.")}
            </small>
          </span>
        </div>
      </section>
      <section className="special-panel">
        <div className="special-copy">
          <span className="eyebrow">
            {special
              ? tr("A LITTLE SOMETHING SPECIAL", "UN PETIT PLAISIR SPÉCIAL")
              : tr(
                  "GOOD THINGS ARE BETTER SHARED",
                  "LES BONS MOMENTS SE PARTAGENT",
                )}
          </span>
          <h2>
            {special
              ? special.title
              : tr("Bring your people.", "Invitez vos proches.")}
            <br />
            <em>
              {special
                ? ""
                : tr("We’ll bring the flavour.", "Nous apportons les saveurs.")}
            </em>
          </h2>
          <p>
            {special
              ? special.description
              : tr(
                  "An overdue catch-up, a family meal, or simply a reason to get together. Make your next moment an NVO moment.",
                  "Des retrouvailles, un repas en famille, ou simplement l’envie de partager. Faites de votre prochain moment un moment NVO.",
                )}
          </p>
          <Link
            className="button gold"
            href={special ? "/offers" : "/reservation"}
          >
            {special
              ? tr("Discover the special", "Découvrir la spécialité")
              : tr("Make a reservation", "Réserver une table")}
            <ArrowUpRight size={19} />
          </Link>
        </div>
        <div className="special-photo">
          <Image
            src={special?.image || "/images/soup.jpeg"}
            alt={special?.title || "A hearty meal at NVO"}
            fill
            sizes="(max-width:700px) 100vw, 45vw"
            style={{ objectFit: "cover" }}
          />
          <span className="photo-script">a table for you.</span>
        </div>
      </section>
      <section className="section visit-preview">
        <div>
          <span className="eyebrow">
            {tr("YOUR NEXT DELICIOUS STOP", "VOTRE PROCHAINE PAUSE GOURMANDE")}
          </span>
          <h2>
            {tr("See you at", "On se retrouve chez")} <em>NVO.</em>
          </h2>
          <p>{data.settings.address}</p>
        </div>
        <a
          className="button"
          href={data.settings.mapsUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => track("directions_clicked")}
        >
          {tr("Find your way here", "Trouver l’itinéraire")}
          <MapPin size={18} />
        </a>
      </section>
    </>
  );
}
