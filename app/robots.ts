import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/cart",
        "/r/",
        "/referral",
        "/fr/cart",
        "/fr/r/",
        "/fr/referral",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
