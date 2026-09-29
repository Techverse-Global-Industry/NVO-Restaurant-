import { SpecialsSpotlight } from "@/components/specials";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { entries, settings } from "@/lib/db";
import { publicCatalog } from "@/lib/catalog";
import { requestLanguage } from "@/lib/request-language";
import { alternates } from "@/lib/seo";
import { languagePath, entryText } from "@/lib/i18n";
import {
  MenuPage,
  MealDetail,
  CartPage,
  ReservationPage,
  ContactPage,
  AboutPage,
  GalleryPage,
  OffersPage,
  ReferralPage,
  ContentPage,
  LegalPage,
} from "@/components/pages";
const titles: Record<string, string> = {
  menu: "Our menu",
  cart: "Your selection",
  reservation: "Reserve a table",
  contact: "Find us",
  about: "Our story",
  gallery: "Gallery",
  offers: "Coupons & rewards",
  specials: "Current specials",
  promotions: "Coupons & rewards",
  referral: "Refer a friend",
  events: "Events",
  news: "NVO journal",
  loyalty: "Our community",
  testimonials: "Guest stories",
  privacy: "Privacy",
  terms: "Terms",
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lang = await requestLanguage();
  const fr = lang === "fr";
  const s = settings();
  const visible = publicCatalog(entries(), s).entries;
  const item = slug[1]
    ? visible.find(
        (e) =>
          e.id === slug[1] &&
          e.kind ===
            (slug[0] === "menu"
              ? "meals"
              : slug[0] === "news"
                ? "posts"
                : slug[0] === "specials"
                  ? "specials"
                  : "events"),
      )
    : undefined;
  if (
    slug.length > 2 ||
    (slug[1] &&
      ["menu", "news", "events", "specials"].includes(slug[0]) &&
      !item)
  )
    notFound();
  if (!titles[slug[0]] && slug[0] !== "r") notFound();
  const descriptions: Record<string, string> = {
    specials:
      "Discover the current specials at NVO Restaurant in Agblangandan, Cotonou. Explore each kitchen spotlight and ask our team for availability on WhatsApp.",
    menu: "Explore Nigerian favourites, seafood, rice, soups and drinks at NVO Restaurant in Agblangandan, Cotonou. Prepare your order on WhatsApp.",
    about:
      "Discover NVO Restaurant in Cotonou: Nigerian flavours, seafood and a warm welcome in Agblangandan.",
    contact:
      "Find NVO Restaurant near Commissariat Agblangandan, Cotonou. View our Google map, WhatsApp contact and visiting information.",
    reservation:
      "Request a table at NVO Restaurant, Agblangandan, Cotonou. Tell us your preferred date and party size for confirmation by our team.",
    gallery:
      "Food photography and a kitchen video from NVO Restaurant in Cotonou. Explore our soups, rice and seafood dishes.",
    offers:
      "Discover NVO coupon cards and rewards. Check each coupon’s terms, availability and validity before claiming your named card.",
    events:
      "Explore occasions and gatherings at NVO Restaurant in Cotonou. Contact our team to confirm event details.",
    news: "Stories, food inspiration and updates from the NVO Restaurant kitchen in Cotonou.",
    loyalty:
      "Community recognition and updates from NVO Restaurant in Cotonou.",
    testimonials:
      "Guest experiences shared with permission by NVO Restaurant in Cotonou.",
    privacy:
      "How NVO Restaurant handles website orders, reservations, cookies and personal information.",
    terms:
      "Ordering, reservation and offer terms for the NVO Restaurant website.",
  };
  const frenchTitles: Record<string, string> = {
    menu: "Carte & spécialités à Cotonou",
    cart: "Votre sélection",
    reservation: "Réserver une table",
    contact: "Adresse & contact à Cotonou",
    about: "Notre histoire",
    gallery: "Galerie",
    offers: "Coupons & privilèges",
    specials: "Spécialités du moment",
    promotions: "Coupons & privilèges",
    referral: "Inviter un ami",
    events: "Événements",
    news: "Journal NVO",
    loyalty: "Notre communauté",
    testimonials: "Avis de nos clients",
    privacy: "Confidentialité",
    terms: "Conditions",
  };
  const frenchDescriptions: Record<string, string> = {
    menu: "La carte NVO à Cotonou : riz jollof, soupes nigérianes, shawarmas, grillades et plateaux de fruits de mer. Commandez sur WhatsApp à Agblangandan.",
    about:
      "Découvrez NVO Restaurant à Agblangandan, Cotonou : cuisine nigériane, fruits de mer et accueil chaleureux.",
    contact:
      "Retrouvez NVO Restaurant près du Commissariat à Agblangandan, Cotonou. Adresse, carte Google et contact WhatsApp pour commander ou nous rendre visite.",
    reservation:
      "Réservez une table chez NVO Restaurant à Agblangandan, Cotonou. Indiquez la date et le nombre de convives ; notre équipe confirme votre réservation.",
    gallery:
      "Découvrez les photos des plats et la vidéo de cuisine de NVO Restaurant à Cotonou : soupes, riz et fruits de mer.",
    offers:
      "Découvrez les coupons NVO. Consultez les conditions, disponibilités et dates de validité avant de réclamer votre carte nominative.",
    specials:
      "Les spécialités du moment chez NVO Restaurant à Cotonou. Découvrez les propositions de notre cuisine et confirmez leur disponibilité sur WhatsApp.",
    events:
      "Événements et rencontres chez NVO Restaurant à Cotonou. Contactez notre équipe pour confirmer les détails.",
    news: "Actualités, inspirations gourmandes et nouvelles de la cuisine NVO Restaurant à Cotonou.",
    loyalty: "Les nouvelles de la communauté NVO Restaurant à Cotonou.",
    testimonials:
      "Expériences de nos clients, partagées avec leur accord par NVO Restaurant à Cotonou.",
    privacy:
      "Comment NVO Restaurant traite les commandes, réservations, cookies et données personnelles sur son site.",
    terms:
      "Conditions de commande, de réservation et des offres sur le site NVO Restaurant.",
  };
  const localized = item ? entryText(item, lang) : undefined;
  const title = localized
    ? `${localized.title}${item?.kind === "meals" ? (fr ? " à Cotonou" : " in Cotonou") : ""}`
    : (fr
        ? frenchTitles[slug[0]]
        : slug[0] === "menu"
          ? "Menu & Nigerian seafood in Cotonou"
          : titles[slug[0]]) || "NVO";
  const description =
    (localized
      ? `${localized.description.split("\n")[0]} ${fr ? "Chez NVO Restaurant, Cotonou." : "At NVO Restaurant, Cotonou."}`.slice(
          0,
          160,
        )
      : "") ||
    (fr ? frenchDescriptions[slug[0]] : undefined) ||
    descriptions[slug[0]] ||
    "Explore NVO Restaurant in Cotonou.";
  const canonical =
    "/" +
    (slug[0] === "promotions"
      ? "offers"
      : slug.map(encodeURIComponent).join("/"));
  return {
    title,
    description,
    alternates: alternates(canonical, lang),
    openGraph: {
      title: `${title} · NVO Restaurant`,
      description,
      url: languagePath(canonical, lang),
      locale: fr ? "fr_FR" : "en_GB",
      alternateLocale: [fr ? "en_GB" : "fr_FR"],
      type: "website",
      images: [item?.image || "/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · NVO Restaurant`,
      description,
      images: [item?.image || "/opengraph-image"],
    },
    robots:
      s.previewContent ||
      item?.demo ||
      ["cart", "r", "referral"].includes(slug[0])
        ? { index: false, follow: false }
        : undefined,
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const [section, id] = slug;
  if (slug.length > 2) notFound();
  if (id && ["menu", "news", "events", "specials"].includes(section)) {
    const kind =
      section === "menu"
        ? "meals"
        : section === "news"
          ? "posts"
          : section === "specials"
            ? "specials"
            : "events";
    if (
      !publicCatalog(entries(), settings()).entries.some(
        (e) => e.id === id && e.kind === kind,
      )
    )
      notFound();
  }
  if (section === "specials") return <SpecialsSpotlight standalone id={id} />;
  if (section === "menu") return id ? <MealDetail id={id} /> : <MenuPage />;
  if (section === "r" && id) return <ReferralPage code={id} />;
  if (section === "news" || section === "events")
    return (
      <ContentPage kind={section === "news" ? "posts" : "events"} id={id} />
    );
  if (id) notFound();
  switch (section) {
    case "cart":
      return <CartPage />;
    case "reservation":
      return <ReservationPage />;
    case "contact":
      return <ContactPage />;
    case "about":
      return <AboutPage />;
    case "gallery":
      return <GalleryPage />;
    case "offers":
    case "promotions":
      return <OffersPage />;
    case "referral":
      return <ReferralPage />;
    case "loyalty":
      return <ContentPage kind="loyalty" />;
    case "testimonials":
      return <ContentPage kind="testimonials" />;
    case "privacy":
      return <LegalPage privacy />;
    case "terms":
      return <LegalPage privacy={false} />;
    default:
      notFound();
  }
}
