"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { languagePath, stripLanguage, type Language } from "@/lib/i18n";
import type { CartLine, PublicData } from "@/lib/types";
import { changeQuantity, completeCart } from "@/lib/cart";
type ContextValue = {
  data: PublicData;
  lang: "en" | "fr";
  setLang: (s: "en" | "fr") => void;
  tr: (en: string, fr: string) => string;
  cart: CartLine[];
  add: (id: string) => void;
  quantity: (id: string, n: number) => void;
  clear: () => void;
  completeOrder: (lines: CartLine[]) => void;
  toast: (s: string) => void;
};
const Context = createContext<ContextValue | null>(null);
export async function api(route: string, data: unknown) {
  const r = await fetch("/api/" + route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error || "Please try again.");
  return result;
}
let analyticsQueue = Promise.resolve<unknown>(undefined);
export function track(
  event: string,
  page = window.location.pathname,
  details: { itemId?: string; quantity?: number } = {},
) {
  page = stripLanguage(page);
  if (
    page.startsWith("/admin") ||
    localStorage.getItem("nvo-analytics") !== "yes" ||
    navigator.doNotTrack === "1"
  )
    return;
  const source =
    Date.now() - Number(sessionStorage.getItem("nvo-source-at") || 0) <
    30 * 60000
      ? sessionStorage.getItem("nvo-source") || "direct"
      : "direct";
  const payload = {
    id: crypto.randomUUID(),
    consent: true,
    ...details,
    event,
    page,
    source,
  };
  analyticsQueue = analyticsQueue
    .then(() => api("analytics", payload))
    .catch(() => {});
}
export function Provider({
  initial,
  initialLanguage = "en",
  children,
}: {
  initial: PublicData;
  initialLanguage?: Language;
  children: ReactNode;
}) {
  const [data, setData] = useState(initial);
  const [lang, setLanguage] = useState<Language>(initialLanguage);
  const [cart, setCart] = useState<CartLine[]>([]);
  const cartRef = useRef<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [consent, setConsent] = useState<string | null>("unset");
  const actualPath = usePathname();
  const pathname = stripLanguage(actualPath);
  const router = useRouter();
  const lastCatalogPath = useRef(pathname);
  const lastTrackedPath = useRef<string | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("nvo-cart") || "[]");
      if (Array.isArray(saved))
        updateCart(
          saved.filter(
            (x) =>
              typeof x.id === "string" &&
              Number.isInteger(x.quantity) &&
              x.quantity > 0 &&
              x.quantity <= 30,
          ),
        );
    } catch {}
    if (pathname.startsWith("/admin"))
      setLanguage(localStorage.getItem("nvo-lang") === "fr" ? "fr" : "en");
    setConsent(localStorage.getItem("nvo-analytics"));
    setReady(true);
    const source = new URLSearchParams(location.search).get("utm_source");
    if (source) {
      sessionStorage.setItem("nvo-source", source);
      sessionStorage.setItem("nvo-source-at", String(Date.now()));
    }
  }, []);
  useEffect(() => {
    if (!pathname.startsWith("/admin"))
      setLanguage(
        actualPath === "/fr" || actualPath.startsWith("/fr/") ? "fr" : "en",
      );
  }, [actualPath, pathname]);
  useEffect(() => {
    // Keep another open tab from retaining meals already ordered in this one.
    function syncCart(event: StorageEvent) {
      if (event.key !== "nvo-cart") return;
      try {
        const saved = JSON.parse(event.newValue || "[]");
        if (!Array.isArray(saved)) return;
        const lines = saved.filter(
          (x) =>
            x &&
            typeof x.id === "string" &&
            Number.isInteger(x.quantity) &&
            x.quantity > 0 &&
            x.quantity <= 30,
        );
        cartRef.current = lines;
        setCart(lines);
      } catch {}
    }
    window.addEventListener("storage", syncCart);
    return () => window.removeEventListener("storage", syncCart);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem("nvo-cart", JSON.stringify(cart));
  }, [cart, ready]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    if (!ready) return;
    if (consent === "yes" && lastTrackedPath.current !== pathname) {
      lastTrackedPath.current = pathname;
      track("page_view", pathname);
    }
    // Initial catalogue is already server-rendered. Refresh only on navigation.
    if (lastCatalogPath.current === pathname) return;
    lastCatalogPath.current = pathname;
    fetch("/api/catalog")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [pathname, ready, consent]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(timer);
  }, [notice]);
  function setLang(v: "en" | "fr") {
    setLanguage(v);
    localStorage.setItem("nvo-lang", v);
    if (!pathname.startsWith("/admin"))
      router.push(
        languagePath(pathname, v) +
          window.location.search +
          window.location.hash,
        { scroll: false },
      );
  }
  const tr = (en: string, fr: string) => (lang === "fr" ? fr : en);
  function updateCart(lines: CartLine[]) {
    cartRef.current = lines;
    setCart(lines);
    // Persist immediately, including when navigating away after checkout.
    localStorage.setItem("nvo-cart", JSON.stringify(lines));
  }
  function add(id: string) {
    const result = changeQuantity(
      cartRef.current,
      id,
      (cartRef.current.find((x) => x.id === id)?.quantity || 0) + 1,
    );
    if (!result.delta) return;
    updateCart(result.lines);
    track("add_to_cart", undefined, { itemId: id, quantity: result.delta });
    setNotice(tr("Added to your selection", "Ajouté à votre sélection"));
  }
  function quantity(id: string, n: number) {
    if (!cartRef.current.some((x) => x.id === id)) return;
    const result = changeQuantity(cartRef.current, id, n);
    if (!result.delta) return;
    updateCart(result.lines);
    track(result.delta > 0 ? "add_to_cart" : "remove_from_cart", undefined, {
      itemId: id,
      quantity: Math.abs(result.delta),
    });
  }
  function clear() {
    for (const line of cartRef.current)
      track("remove_from_cart", undefined, {
        itemId: line.id,
        quantity: line.quantity,
      });
    updateCart([]);
  }
  return (
    <Context.Provider
      value={{
        data,
        lang,
        setLang,
        tr,
        cart,
        add,
        quantity,
        clear,
        completeOrder: (lines) =>
          updateCart(completeCart(cartRef.current, lines)),
        toast: setNotice,
      }}
    >
      {children}
      {notice && (
        <div className="toast" role="status">
          ✓ {notice}
        </div>
      )}
      {consent === null && !pathname.startsWith("/admin") && (
        <div className="cookie-bar">
          <p>
            {tr(
              "Help us improve your NVO experience? Optional analytics measure visits and menu interest.",
              "Nous aider à améliorer votre expérience ? Les statistiques facultatives mesurent les visites et votre intérêt.",
            )}
          </p>
          <button
            onClick={() => {
              localStorage.setItem("nvo-analytics", "yes");
              setConsent("yes");
            }}
          >
            {tr("Allow", "Accepter")}
          </button>
          <button
            className="text-button"
            onClick={() => {
              localStorage.setItem("nvo-analytics", "no");
              setConsent("no");
            }}
          >
            {tr("No thanks", "Non merci")}
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function useNvo() {
  const c = useContext(Context);
  if (!c) throw new Error("NVO provider missing");
  return c;
}
