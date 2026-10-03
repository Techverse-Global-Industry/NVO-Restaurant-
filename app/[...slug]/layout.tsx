import { entries, settings } from "@/lib/db";
import { publicCatalog } from "@/lib/catalog";
import { requestLanguage } from "@/lib/request-language";
import { absoluteUrl, jsonLd, menuItemSchema, menuSchema } from "@/lib/seo";
import { languagePath, entryText } from "@/lib/i18n";
export default async function SectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const lang = await requestLanguage();
  const [allEntries, currentSettings] = await Promise.all([entries(), settings()]);
  const data = publicCatalog(allEntries, currentSettings);
  const kind = (
    {
      menu: "meals",
      news: "posts",
      events: "events",
      specials: "specials",
    } as Record<string, string>
  )[slug[0]];
  const item =
    slug.length === 2
      ? data.entries.find((e) => e.id === slug[1] && e.kind === kind)
      : undefined;
  const names: Record<string, [string, string]> = {
    menu: ["Our menu", "Notre carte"],
    about: ["Our story", "Notre histoire"],
    ceo: ["Meet the CEO", "Rencontrez le PDG"],
    gallery: ["Gallery", "Galerie"],
    news: ["NVO journal", "Journal NVO"],
    events: ["Events", "?v?nements"],
    contact: ["Find us", "Nous trouver"],
    reservation: ["Reserve a table", "R?server une table"],
    offers: ["Coupons & rewards", "Coupons & privil?ges"],
    specials: ["Current specials", "Sp?cialit?s du moment"],
    loyalty: ["Our community", "Notre communaut?"],
  };
  if (
    !names[slug[0]] ||
    item?.demo ||
    slug.length > 2 ||
    (slug.length === 2 && !item)
  )
    return children;
  const url = (p: string) => absoluteUrl(languagePath(p, lang));
  const crumbs = [
    {
      "@type": "ListItem",
      position: 1,
      name: "NVO Restaurant",
      item: url("/"),
    },
    {
      "@type": "ListItem",
      position: 2,
      name: names[slug[0]][lang === "fr" ? 1 : 0],
      item: url(`/${slug[0]}`),
    },
  ];
  if (item)
    crumbs.push({
      "@type": "ListItem",
      position: 3,
      name: entryText(item, lang).title,
      item: url(`/${slug[0]}/${item.id}`),
    });
  const schemas: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs,
    },
  ];
  if (slug[0] === "menu" && !slug[1]) schemas.push(menuSchema(data, lang));
  if (item?.kind === "meals")
    schemas.push({
      "@context": "https://schema.org",
      ...menuItemSchema(item, lang),
    });
  return (
    <>
      {schemas.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(s) }}
        />
      ))}
      {children}
    </>
  );
}
