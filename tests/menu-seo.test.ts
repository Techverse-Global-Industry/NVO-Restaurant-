import { test } from "node:test";
import assert from "node:assert/strict";
import { currentMenu } from "../lib/current-menu";
import { initialEntries, initialSettings } from "../lib/seed";
import { planMenuImport } from "../lib/menu-import";
import { publicCatalog } from "../lib/catalog";
import { menuSchema, jsonLd, alternates } from "../lib/seo";
import { languagePath, stripLanguage } from "../lib/i18n";

test("complete bilingual PDF menu retains prices, variants, pre-orders and unpriced accompaniments", () => {
  const meals = currentMenu.filter((e) => e.kind === "meals");
  assert.equal(meals.length, 77);
  assert.equal(currentMenu.filter((e) => e.kind === "categories").length, 10);
  assert.equal(new Set(currentMenu.map((e) => e.id)).size, currentMenu.length);
  assert.ok(meals.every((e) => e.titleFr && e.descriptionFr));
  assert.deepEqual(
    meals.filter((e) => e.id.startsWith("seafood-boil-")).map((e) => e.price),
    [15000, 30000, 50000, 100000],
  );
  assert.deepEqual(
    meals.filter((e) => e.id.startsWith("asun-spaghetti-")).map((e) => e.price),
    [3000, 7500],
  );
  assert.deepEqual(
    meals
      .filter((e) => e.id.startsWith("peppered-prawns-option-"))
      .map((e) => e.price),
    [6000, 10000],
  );
  assert.equal(meals.find((e) => e.id === "octopus")?.price, null);
  assert.equal(
    meals.filter((e) => e.category === "swallow" && e.price === null).length,
    6,
  );
  assert.equal(
    meals.find((e) => e.id === "whole-catfish-pepper-soup")?.preorder,
    true,
  );
  assert.ok(
    !meals.some((e) =>
      /15[,. ]000|30[,. ]000|50[,. ]000|100[,. ]000/.test(
        e.title + e.description,
      ),
    ),
  );
});
test("menu import is repeatable and protects staff changes, coupon references and unrelated records", () => {
  const edited = {
    ...initialEntries.find((e) => e.id === "banga")!,
    price: 4500,
    description: "Staff updated description",
  };
  const existing = initialEntries.map((e) => (e.id === "banga" ? edited : e));
  const plan = planMenuImport(existing, ["rice-fish"]);
  assert.ok(plan.preserved.includes("banga"));
  assert.ok(!plan.write.some((e) => e.id === "rice-fish"));
  assert.equal(plan.write.find((e) => e.id === "fish-rice")?.active, false);
  const after = new Map(existing.map((e) => [e.id, e]));
  plan.write.forEach((e) => after.set(e.id, e));
  assert.equal(
    planMenuImport([...after.values()], ["rice-fish"]).write.length,
    0,
  );
  assert.equal(after.get("banga")?.price, 4500);
});
test("menu SEO contains every public dish and never discloses hidden prices or unpublished dishes", () => {
  const hidden = publicCatalog(currentMenu, initialSettings);
  const schema = menuSchema(hidden, "fr");
  const items = schema.hasMenuSection.flatMap((s) => s.hasMenuItem);
  assert.equal(items.length, 77);
  assert.ok(items.every((e) => !e.offers && e.url.includes("/fr/menu/")));
  assert.equal(
    items
      .find((e) => e.name === "Soupe Banga")
      ?.description.startsWith("Soupe Banga"),
    true,
  );
  const entries = currentMenu.map((e) =>
    e.id === "banga"
      ? { ...e, priceVisibility: "hide" as const }
      : e.id === "octopus"
        ? { ...e, active: false }
        : e,
  );
  const shown = menuSchema(
    publicCatalog(entries, { ...initialSettings, showPrices: true }),
    "en",
  ).hasMenuSection.flatMap((s) => s.hasMenuItem);
  assert.equal(shown.find((e) => e.name === "Banga soup")?.offers, undefined);
  assert.equal(
    shown.find((e) => e.name === "Jollof rice & chicken")?.offers?.price,
    2500,
  );
  assert.ok(!shown.some((e) => e.name === "Octopus"));
  assert.ok(
    !jsonLd({ title: "</script><script>alert(1)</script>" }).includes("<"),
  );
});
test("language URLs are stable, canonical and do not localise private endpoints", () => {
  assert.equal(languagePath("/", "fr"), "/fr");
  assert.equal(languagePath("/menu/banga", "fr"), "/fr/menu/banga");
  assert.equal(languagePath("/fr/menu/banga", "en"), "/menu/banga");
  assert.equal(languagePath("/admin", "fr"), "/admin");
  assert.equal(stripLanguage("/fr/menu"), "/menu");
  assert.equal(stripLanguage("/france"), "/france");
  assert.deepEqual(alternates("/menu", "fr"), {
    canonical: "/fr/menu",
    languages: { en: "/menu", fr: "/fr/menu", "x-default": "/menu" },
  });
});
