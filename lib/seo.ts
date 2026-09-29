import type { Metadata } from "next";
import type { Entry, PublicData, Settings } from "./types";
import { entryText, languagePath, type Language } from "./i18n";

export function siteOrigin() {
  return new URL(process.env.SITE_URL || "http://localhost:3000").origin;
}
export function absoluteUrl(path: string) {
  return new URL(path, siteOrigin()).href;
}
export function alternates(
  path: string,
  lang: Language,
): Metadata["alternates"] {
  return {
    canonical: languagePath(path, lang),
    languages: {
      en: languagePath(path, "en"),
      fr: languagePath(path, "fr"),
      "x-default": languagePath(path, "en"),
    },
  };
}
export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
export function menuItemSchema(item: Entry, lang: Language) {
  const text = entryText(item, lang);
  return {
    "@type": "MenuItem",
    "@id": absoluteUrl(languagePath(`/menu/${item.id}`, lang)) + "#dish",
    name: text.title,
    description: text.description,
    url: absoluteUrl(languagePath(`/menu/${item.id}`, lang)),
    image: item.image ? absoluteUrl(item.image) : undefined,
    offers:
      item.price != null
        ? {
            "@type": "Offer",
            price: item.price,
            priceCurrency: "XOF",
            availability:
              "https://schema.org/" +
              (item.available === false
                ? "OutOfStock"
                : item.preorder
                  ? "PreOrder"
                  : "InStock"),
            url: absoluteUrl(languagePath(`/menu/${item.id}`, lang)),
          }
        : undefined,
  };
}
// Always pass the public catalogue, so private prices and drafts never leak into JSON-LD.
export function menuSchema(data: PublicData, lang: Language) {
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    "@id": absoluteUrl(languagePath("/menu", lang)) + "#menu",
    name: lang === "fr" ? "Carte de NVO Restaurant" : "NVO Restaurant menu",
    inLanguage: lang,
    url: absoluteUrl(languagePath("/menu", lang)),
    hasMenuSection: data.entries
      .filter((e) => e.kind === "categories")
      .map((category) => ({
        "@type": "MenuSection",
        name: entryText(category, lang).title,
        hasMenuItem: data.entries
          .filter((e) => e.kind === "meals" && e.category === category.id)
          .map((e) => menuItemSchema(e, lang)),
      }))
      .filter((section) => section.hasMenuItem.length),
  };
}
export function restaurantSchema(s: Settings, lang: Language) {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": absoluteUrl("/#restaurant"),
    name: s.name,
    url: absoluteUrl(languagePath("/", lang)),
    telephone: "+" + s.whatsapp,
    description:
      lang === "fr"
        ? "Restaurant de cuisine nigériane et de fruits de mer à Agblangandan, Cotonou, Bénin."
        : "Nigerian cuisine and seafood restaurant in Agblangandan, Cotonou, Benin.",
    image: [
      absoluteUrl("/images/rice-fish.jpeg"),
      absoluteUrl("/images/banga.jpeg"),
    ],
    sameAs: s.instagram ? [s.instagram] : [],
    address: {
      "@type": "PostalAddress",
      streetAddress: s.address,
      addressLocality: "Agblangandan",
      addressRegion: "Cotonou",
      addressCountry: "BJ",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: s.latitude,
      longitude: s.longitude,
    },
    servesCuisine: ["Nigerian", "Seafood"],
    hasMap: s.mapsUrl,
    hasMenu: {
      "@type": "Menu",
      "@id": absoluteUrl(languagePath("/menu", lang)) + "#menu",
      url: absoluteUrl(languagePath("/menu", lang)),
    },
  };
}
