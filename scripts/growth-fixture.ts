import { db, settings, entry } from "../lib/db";
import type { Entry } from "../lib/types";
if (!process.env.NVO_DB_PATH?.includes("growth-browser-"))
  throw new Error("Use an isolated growth-browser database.");
db()
  .prepare("UPDATE settings SET data=? WHERE id=1")
  .run(
    JSON.stringify({ ...settings(), previewContent: false, showPrices: true }),
  );
const meal = {
  ...entry("banga")!,
  price: 5000,
  active: true,
  available: true,
  priceVisibility: "show",
};
db()
  .prepare("UPDATE entries SET data=? WHERE id=?")
  .run(JSON.stringify(meal), meal.id);
const special: Entry = {
  id: "growth-kitchen-special",
  kind: "specials",
  title: "The kitchen is calling.",
  titleFr: "La cuisine vous appelle.",
  description:
    "A generous bowl of Banga, prepared with the NVO touch. Ask our team for today's availability and price.",
  descriptionFr:
    "Un généreux bol de Banga, préparé avec la touche NVO. Contactez notre équipe pour connaître la disponibilité et le prix.",
  image: "/images/banga.jpeg",
  active: true,
  status: "published",
  featured: true,
  sort: -10,
};
db()
  .prepare("INSERT OR REPLACE INTO entries VALUES(?,?,?)")
  .run(special.id, special.kind, JSON.stringify(special));
for (const [id, extra] of Object.entries({
  "growth-expired": { endsAt: "2020-01-01T00:00:00Z" },
  "growth-future": { startsAt: "2099-01-01T00:00:00Z" },
  "growth-draft": { status: "draft" },
}))
  db()
    .prepare("INSERT OR REPLACE INTO entries VALUES(?,?,?)")
    .run(id, "specials", JSON.stringify({ ...special, ...extra, id }));
db()
  .prepare(
    "INSERT OR IGNORE INTO analytics(id,visitor,event,page,source,created_at) VALUES('legacy-test','old-browser','page_view','/admin','direct',?)",
  )
  .run(new Date().toISOString());
console.log(
  "Isolated growth fixture prepared; live restaurant data was not changed.",
);
