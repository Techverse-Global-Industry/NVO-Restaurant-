import { currentMenu } from "./current-menu";
import { initialEntries } from "./seed";
import { entrySchema } from "./validation";
import type { Entry } from "./types";

const same = (a: Entry, b: Entry) => {
  const normalize = (e: Entry) =>
    JSON.stringify(
      Object.fromEntries(
        Object.entries(e)
          .filter(([, value]) => value !== undefined)
          .sort(([a], [b]) => a.localeCompare(b)),
      ),
    );
  return normalize(a) === normalize(b);
};
export function planMenuImport(
  existing: Entry[],
  protectedMealIds: string[] = [],
) {
  const write: Entry[] = [],
    preserved: string[] = [],
    unchanged: string[] = [];
  for (const item of currentMenu) {
    const incoming = entrySchema.parse(item);
    const current = existing.find((e) => e.id === item.id);
    if (!current) {
      write.push(incoming);
      continue;
    }
    if (current.kind !== item.kind)
      throw new Error(
        `Menu ID conflicts with another content type: ${item.id}`,
      );
    if (same(current, incoming)) {
      unchanged.push(item.id);
      continue;
    }
    const original = initialEntries.find((e) => e.id === item.id);
    if (original && same(current, original))
      write.push({
        ...incoming,
        priceVisibility: current.priceVisibility || incoming.priceVisibility,
      });
    else preserved.push(item.id); // Never overwrite staff edits on a later import.
  }
  // Retire untouched starter placeholders only. Preserve issued coupon references and all records.
  const protectedIds = new Set([
    ...protectedMealIds,
    ...existing
      .filter((e) => e.kind === "campaigns" && e.rewardItem)
      .map((e) => e.rewardItem!),
  ]);
  for (const id of ["rice-fish", "fish-rice", "coke"]) {
    const current = existing.find((e) => e.id === id);
    const original = initialEntries.find((e) => e.id === id);
    if (current && original && same(current, original) && !protectedIds.has(id))
      write.push({ ...current, active: false });
  }
  return { write, preserved, unchanged };
}
