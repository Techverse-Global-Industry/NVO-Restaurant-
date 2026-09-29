"use client";
import Link from "./locale-link";
import { usePathname } from "next/navigation";
import { stripLanguage, languagePath } from "@/lib/i18n";
import { useState } from "react";
import {
  ArrowUpRight,
  ShoppingBag,
  Menu,
  X,
  MapPin,
  Phone,
  Instagram,
  UtensilsCrossed,
  ChevronDown,
} from "lucide-react";
import { useNvo, track } from "./provider";
export function Brand() {
  return (
    <span className="brand">
      <UtensilsCrossed size={24} strokeWidth={1.2} />
      <span>
        NVO<span className="brand-sub">RESTAURANT & BAR</span>
      </span>
    </span>
  );
}
export function Header() {
  const { tr, lang, setLang, cart } = useNvo();
  const pathname = stripLanguage(usePathname());
  const [open, setOpen] = useState(false);
  if (pathname.startsWith("/admin")) return null;
  const links = [
    ["/menu", tr("Our menu", "Notre carte")],
    ["/specials", tr("Current specials", "À l’honneur")],
    ["/offers", tr("Coupons & rewards", "Coupons & privilèges")],
    ["/about", tr("The NVO story", "Notre histoire")],
    ["/events", tr("What’s on", "Événements")],
  ];
  return (
    <>
      <div
        className="announcement"
        role="region"
        aria-label={tr("Welcome to NVO", "Bienvenue chez NVO")}
      >
        {tr(
          "Good food. Good company. A little NVO magic.",
          "De bons plats. De bons moments. La touche NVO.",
        )}
        <span>
          COTONOU, BÉNIN <span className="tiny-star">✦</span>
        </span>
      </div>
      <header className="site-header">
        <Link href="/">
          <Brand />
        </Link>
        <nav aria-label="Main navigation">
          {links.map(([href, label]) => (
            <Link
              className={
                pathname === href || pathname.startsWith(href + "/")
                  ? "active"
                  : ""
              }
              key={href}
              href={href}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className="language"
            onClick={() => setLang(lang === "en" ? "fr" : "en")}
            aria-label={`${lang.toUpperCase()} — Change language`}
          >
            <span>{lang.toUpperCase()}</span>
            <ChevronDown size={12} aria-hidden="true" />
          </button>
          <Link
            href="/cart"
            className="cart-button"
            aria-label={tr("Open cart", "Ouvrir le panier")}
          >
            <ShoppingBag size={20} />
            {cart.length > 0 && (
              <span>{cart.reduce((n, c) => n + c.quantity, 0)}</span>
            )}
          </Link>
          <Link className="button small desktop-order" href="/menu">
            {tr("Order now", "Commander")}
            <ArrowUpRight size={17} />
          </Link>
          <button
            className="mobile-toggle"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {open && (
        <nav className="mobile-menu" aria-label="Mobile navigation">
          {[
            ...links,
            ["/contact", tr("Find us", "Nous trouver")],
            ["/loyalty", tr("Our community", "Notre communauté")],
          ].map(([href, label]) => (
            <Link key={href} onClick={() => setOpen(false)} href={href}>
              {label}
              <ArrowUpRight size={18} />
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}
export function Footer() {
  const { tr, data } = useNvo();
  const pathname = stripLanguage(usePathname());
  if (pathname.startsWith("/admin")) return null;
  return (
    <>
      <footer className="footer">
        <div className="footer-top">
          <div>
            <Link href="/">
              <Brand />
            </Link>
            <p>
              {tr(
                "A little taste of home.\nA whole lot of flavour.",
                "Un petit goût de chez vous.\nBeaucoup de saveurs.",
              )}
            </p>
            <a
              className="social"
              href={data.settings.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
            >
              <Instagram size={20} />
            </a>
          </div>
          <div>
            <h3>{tr("Come hungry", "Venez avec appétit")}</h3>
            <Link href="/menu">
              {tr("Explore the menu", "Découvrir la carte")}
            </Link>
            <Link href="/reservation">
              {tr("Reserve a table", "Réserver une table")}
            </Link>
            <Link href="/specials">
              {tr("Current specials", "Spécialités du moment")}
            </Link>
            <Link href="/offers">
              {tr("Coupons & rewards", "Coupons & privilèges")}
            </Link>
            <Link href="/referral">
              {tr("Refer a friend", "Inviter un ami")}
            </Link>
          </div>
          <div>
            <h3>{tr("Stay a little", "Découvrez NVO")}</h3>
            <Link href="/about">{tr("Our story", "Notre histoire")}</Link>
            <Link href="/gallery">{tr("The gallery", "La galerie")}</Link>
            <Link href="/news">{tr("NVO journal", "Le journal NVO")}</Link>
            <Link href="/subscribe">
              {tr("WhatsApp updates", "Les nouvelles sur WhatsApp")}
            </Link>
            <Link href="/loyalty">
              {tr("Our community", "Notre communauté")}
            </Link>
          </div>
          <div>
            <h3>{tr("Find your way to NVO", "Retrouvez-nous")}</h3>
            <a
              href={data.settings.mapsUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("directions_clicked")}
            >
              <MapPin size={17} />
              {data.settings.address}
            </a>
            <a
              href={`https://wa.me/${data.settings.whatsapp}`}
              target="_blank"
              rel="noreferrer"
            >
              <Phone size={16} />+{data.settings.whatsapp}
            </a>
            <Link href="/contact">
              {tr("Contact & directions", "Contact & itinéraire")}{" "}
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} NVO Restaurant.{" "}
            {tr("Made for good moments.", "Pour les bons moments.")}
          </span>
          <div>
            <Link href="/privacy">{tr("Privacy", "Confidentialité")}</Link>
            <Link href="/terms">{tr("Terms", "Conditions")}</Link>
            <Link href="/admin">{tr("Staff access", "Espace équipe")}</Link>
            <span className="language-links">
              <a href={languagePath(pathname, "en")} hrefLang="en" lang="en">
                English
              </a>
              <a href={languagePath(pathname, "fr")} hrefLang="fr" lang="fr">
                Français
              </a>
            </span>
          </div>
        </div>
      </footer>
      {pathname !== "/cart" && (
        <nav aria-label={tr("Quick ordering", "Commande rapide")}>
          <Link className="mobile-order" href="/menu">
            <UtensilsCrossed size={18} />
            {tr("Something delicious awaits", "Un bon repas vous attend")}
            <ArrowUpRight size={18} />
          </Link>
        </nav>
      )}
    </>
  );
}
