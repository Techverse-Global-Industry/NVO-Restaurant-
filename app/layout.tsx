import type { Metadata } from "next";
import { Provider } from "@/components/provider";
import { Header, Footer } from "@/components/shell";
import { entries, settings } from "@/lib/db";
import { publicCatalog } from "@/lib/catalog";
import "./globals.css";
import "./fonts.css";
import "./royal.css";
import "./social.css";
import "./experience.css";
import "./growth.css";
import { RestaurantMotion } from "@/components/motion";
import { ChefHost } from "@/components/chef";
import { requestLanguage } from "@/lib/request-language";
import { siteOrigin } from "@/lib/seo";
import "./menu.css";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const fr = (await requestLanguage()) === "fr";
  const title = fr
    ? "NVO Restaurant · Cuisine nigériane & fruits de mer à Cotonou"
    : "NVO Restaurant · Nigerian food & seafood in Cotonou";
  const description = fr
    ? "Découvrez la carte NVO : riz jollof, soupes nigérianes, shawarmas et plateaux de fruits de mer. Commandez sur WhatsApp à Agblangandan, Cotonou."
    : "Explore NVO’s jollof rice, Nigerian soups, shawarma and seafood platters. Order on WhatsApp or visit our restaurant in Agblangandan, Cotonou.";
  return {
    title: {
      default: title,
      template: "%s · NVO Restaurant",
    },
    description,
    metadataBase: new URL(siteOrigin()),
    robots: settings().previewContent
      ? { index: false, follow: true }
      : { index: true, follow: true },
    applicationName: "NVO Restaurant",
    verification: process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : undefined,
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
    openGraph: {
      title,
      description,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "NVO Restaurant — Nigerian flavours and seafood in Cotonou",
        },
      ],
      type: "website",
      siteName: "NVO Restaurant",
      locale: fr ? "fr_FR" : "en_GB",
      alternateLocale: [fr ? "en_GB" : "fr_FR"],
    },
  };
}
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = publicCatalog(entries(), settings());
  const lang = await requestLanguage();
  return (
    <html lang={lang}>
      <head>
        <link
          rel="preload"
          href="/fonts/nvo-font-1.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/nvo-font-5.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <a className="skip-link" href="#main">
          {lang === "fr" ? "Aller au contenu" : "Skip to content"}
        </a>
        <Provider initial={data} initialLanguage={lang}>
          <Header />
          <main id="main">{children}</main>
          <Footer />
          <ChefHost />
          <RestaurantMotion />
        </Provider>
      </body>
    </html>
  );
}
