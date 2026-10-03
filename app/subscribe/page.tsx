import type { Metadata } from "next";
import { Subscribe } from "@/components/subscribe";
import { db } from "@/lib/db";
import { whatsappConfig } from "@/lib/social/whatsapp";
import { requestLanguage } from "@/lib/request-language";
import { alternates } from "@/lib/seo";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const lang = await requestLanguage();
  return {
    title: lang === "fr" ? "Les nouvelles sur WhatsApp" : "WhatsApp updates",
    description:
      lang === "fr"
        ? "Inscrivez-vous aux nouvelles et spécialités de NVO Restaurant sur WhatsApp. Vous pouvez vous désinscrire à tout moment."
        : "Choose to receive NVO Restaurant news and specials on WhatsApp. Subscribe yourself and unsubscribe at any time.",
    alternates: alternates("/subscribe", lang),
    robots: { index: false, follow: true },
  };
}
export default async function Page() {
  const connected = !!(await db()
    .prepare(
      "SELECT id FROM social_accounts WHERE platform='whatsapp' AND status='connected'",
    )
    .get());
  const config = connected ? await whatsappConfig() : null;
  return (
    <section>
      <Subscribe phone={config?.phone || null} />
    </section>
  );
}
