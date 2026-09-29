import { Home } from "@/components/royal-home";
import { settings } from "@/lib/db";
import { requestLanguage } from "@/lib/request-language";
import { alternates, jsonLd, restaurantSchema } from "@/lib/seo";
import type { Metadata } from "next";
export async function generateMetadata(): Promise<Metadata> {
  return { alternates: alternates("/", await requestLanguage()) };
}
export default async function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(restaurantSchema(settings(), await requestLanguage())),
        }}
      />
      <div className="home-content">
        <Home />
      </div>
    </>
  );
}
