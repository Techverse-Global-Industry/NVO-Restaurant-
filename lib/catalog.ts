import type { Entry, PublicData, Settings } from "./types";
export function isLive(e: Entry, now = Date.now()) {
  return (
    e.active &&
    e.status !== "draft" &&
    !e.demo &&
    (!e.startsAt || Date.parse(e.startsAt) <= now) &&
    (!e.endsAt || Date.parse(e.endsAt) > now)
  );
}
export function visiblePrice(e: Entry, s: Settings) {
  return (
    e.priceVisibility === "show" ||
    (e.priceVisibility !== "hide" && s.showPrices)
  );
}
export function publicCatalog(all: Entry[], s: Settings): PublicData {
  const visibleCategories = new Set(
    all.filter((e) => e.kind === "categories" && isLive(e)).map((e) => e.id),
  );
  return {
    settings: s,
    entries: all
      .filter(
        (e) =>
          (isLive(e) ||
            (!!s.previewContent &&
              !!e.demo &&
              ["posts", "events", "specials"].includes(e.kind) &&
              isLive({ ...e, demo: false }))) &&
          (e.kind !== "meals" ||
            !e.category ||
            visibleCategories.has(e.category)),
      )
      .map((e) => {
        const safe = { ...e };
        if (e.kind === "meals" && !visiblePrice(e, s)) safe.price = null;
        if (e.kind === "campaigns") {
          delete safe.code;
        }
        return safe;
      }),
  };
}
export function money(value: number) {
  return (
    new Intl.NumberFormat("fr-BJ", { maximumFractionDigits: 0 }).format(value) +
    " FCFA"
  );
}
