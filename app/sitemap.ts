import type { MetadataRoute } from "next";
import { entries, settings } from "@/lib/db";
import { publicCatalog } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/seo";
import { languagePath } from "@/lib/i18n";
export const dynamic = "force-dynamic";
export default function sitemap(): MetadataRoute.Sitemap {
  if (settings().previewContent) return [];
  const paths = [
    "/",
    "/menu",
    "/offers",
    "/specials",
    "/events",
    "/about",
    "/gallery",
    "/contact",
    "/reservation",
    "/news",
    "/loyalty",
    ...publicCatalog(entries(), settings())
      .entries.filter(
        (e) =>
          !e.demo && ["meals", "posts", "events", "specials"].includes(e.kind),
      )
      .map(
        (e) =>
          `/${e.kind === "meals" ? "menu" : e.kind === "posts" ? "news" : e.kind}/${encodeURIComponent(e.id)}`,
      ),
  ];
  return paths.flatMap((path) =>
    (["en", "fr"] as const).map((lang) => ({
      url: absoluteUrl(languagePath(path, lang)),
      changeFrequency: "weekly" as const,
      priority: path === "/" ? 1 : path === "/menu" ? 0.9 : 0.7,
      alternates: {
        languages: {
          en: absoluteUrl(languagePath(path, "en")),
          fr: absoluteUrl(languagePath(path, "fr")),
          "x-default": absoluteUrl(languagePath(path, "en")),
        },
      },
    })),
  );
}
