import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { db } from "../lib/db";
import { claim } from "../lib/rewards";
import {
  couponAvailability,
  publicReward,
  counterQuote,
  redeemCounter,
  claimantName,
  nameLegacyCoupon,
} from "../lib/coupons";
import { networkHash } from "../lib/network";
import { standardCaptions, payloadFor } from "../lib/social/captions";
import { captionLimits } from "../lib/social/types";
import type { Entry } from "../lib/types";
process.env.NVO_DB_PATH = ":memory:";
process.env.ADMIN_PASSWORD = "";
test("older coupons accept their owner's name once without changing the issued code", async () => {
  const e = campaign();
  const old = await claim(e.id, "legacy-owner");
  await assert.rejects(
    nameLegacyCoupon(old.id, "another-browser", "Other Guest", "ip"),
    /wallet/,
  );
  const named = await nameLegacyCoupon(old.id, "legacy-owner", "Legacy Guest", "ip");
  assert.equal(named.code, old.code);
  assert.equal(named.claimant_name, "Legacy Guest");
  await assert.rejects(
    nameLegacyCoupon(old.id, "legacy-owner", "Changed Name", "ip"),
    /registered name/,
  );
});
function campaign(extra: Partial<Entry> = {}) {
  const e: Entry = {
    id: randomUUID(),
    kind: "campaigns",
    title: "A guest privilege",
    description: "Ten percent off, minimum 2000 FCFA.",
    discountType: "percent",
    discountValue: 10,
    minOrder: 2000,
    maxDiscount: 700,
    claimLimit: 2,
    active: true,
    status: "published",
    sort: 1,
    validityDays: 7,
    ...extra,
  };
  db()
    .prepare("INSERT INTO entries VALUES(?,?,?)")
    .run(e.id, e.kind, JSON.stringify(e));
  return e;
}
test("one IP cannot claim again with a new browser, but another IP can claim", async () => {
  const e = campaign();
  const r = await claim(e.id, "browser-one", undefined, {
    name: "Ada Guest",
    network: "network-one",
  });
  assert.equal(r.claimant_name, "Ada Guest");
  assert.ok(r.claimed_at);
  assert.match(r.code, /^NVO-[A-F0-9]{10}$/);
  await assert.rejects(
      claim(e.id, "new-browser", undefined, {
        name: "New Name",
        network: "network-one",
      }),
    /network/,
  );
  assert.ok(
    await claim(e.id, "browser-two", undefined, {
      name: "Other Guest",
      network: "network-two",
    }),
  );
  assert.equal(
    (await couponAvailability(null, "network-one")).find((x) => x.id === e.id)?.claimed,
    true,
  );
  assert.equal(
    (await couponAvailability(null, "network-three")).find((x) => x.id === e.id)
      ?.remaining,
    0,
  );
  db()
    .prepare("UPDATE entries SET data=? WHERE id=?")
    .run(JSON.stringify({ ...e, claimLimit: 3 }), e.id);
  assert.equal(
    (await couponAvailability(null, "network-three")).find((x) => x.id === e.id)
      ?.remaining,
    1,
  );
  await assert.rejects(
      claim(e.id, "new-browser", undefined, {
        name: "Ada Again",
        network: "network-one",
      }),
    /network/,
  );
  assert.ok(
    await claim(e.id, "browser-three", undefined, {
      name: "Third Guest",
      network: "network-three",
    }),
  );
  assert.ok(!("network_hash" in publicReward(r)));
  assert.ok(!("customer_id" in publicReward(r)));
});
test("untrusted forwarded IPs fail; signed addresses produce stable private hashes", async () => {
  process.env.NVO_INTERNAL_IP_KEY = "test-key";
  await assert.rejects(
    networkHash(new Headers({ "x-forwarded-for": "1.2.3.4" })),
    /unavailable/,
  );
  const headers = new Headers({
    "x-nvo-client-ip": "192.0.2.1",
    "x-nvo-ip-signature": createHmac("sha256", "test-key")
      .update("192.0.2.1")
      .digest("hex"),
  });
  const hash = await networkHash(headers);
  assert.equal(hash.length, 64);
  assert.equal(hash, await networkHash(headers));
  assert.notEqual(hash, "192.0.2.1");
  headers.set("x-nvo-client-ip", "192.0.2.2");
  await assert.rejects(networkHash(headers), /verification/);
});
test("counter redemption validates name, payment, minimum spend, discount cap and single use", async () => {
  const e = campaign();
  const r = await claim(e.id, "walkin", undefined, {
    name: "Amina Guest",
    network: "walkin",
  });
  const staffId = randomUUID();
  db()
    .prepare("INSERT INTO staff VALUES(?,?,?,?)")
    .run(staffId, staffId + "@test.invalid", "unused", "service");
  const sale = {
    code: r.code,
    name: "amina guest",
    paid: true,
    items: [{ name: "Lunch", quantity: 2, unitPrice: 5000 }],
  };
  await assert.rejects(
    counterQuote({ ...sale, name: "Different Person" }),
    /name/,
  );
  await assert.rejects(counterQuote({ ...sale, paid: false }), /payment/);
  await assert.rejects(
      counterQuote({
        ...sale,
        items: [{ name: "Snack", quantity: 1, unitPrice: 1000 }],
      }),
    /Minimum/,
  );
  assert.equal((await counterQuote(sale)).discount, 700);
  db()
    .prepare("UPDATE entries SET data=? WHERE id=?")
    .run(JSON.stringify({ ...e, discountValue: 90 }), e.id);
  const receipt = await redeemCounter(sale, staffId);
  assert.match(receipt.id, /^NVO-SALE-/);
  assert.equal(receipt.total, 9300);
  await assert.rejects(redeemCounter(sale, staffId), /already/);
  assert.equal(
    (
      db()
        .prepare("SELECT count(*) AS n FROM counter_sales WHERE reward_id=?")
        .get(r.id) as { n: number }
    ).n,
    1,
  );
});
test("free-dish coupons require the matching receipt item; inactive and held cards cannot redeem", async () => {
  const e = campaign({
    discountType: "free",
    rewardItem: "banga",
    minOrder: 0,
    maxDiscount: undefined,
  });
  const r = await claim(e.id, "free", undefined, {
    name: "Free Guest",
    network: "free",
  });
  const sale = {
    code: r.code,
    name: "Free Guest",
    paid: true,
    items: [{ name: "Soup", mealId: "banga", quantity: 2, unitPrice: 4500 }],
  };
  assert.equal((await counterQuote(sale)).discount, 4500);
  await assert.rejects(
      counterQuote({
        ...sale,
        items: [{ name: "Rice", mealId: "rice", quantity: 1, unitPrice: 4500 }],
      }),
    /free dish/,
  );
  db().prepare("UPDATE rewards SET status='held' WHERE id=?").run(r.id);
  await assert.rejects(counterQuote(sale), /website order/);
  db()
    .prepare("UPDATE rewards SET status='claimed',active_at=? WHERE id=?")
    .run(new Date(Date.now() + 86400000).toISOString(), r.id);
  await assert.rejects(counterQuote(sale), /not active/);
  assert.equal(claimantName.safeParse("<script>").success, false);
});
test("captions are distinct, bilingual and fit every platform without removing an advertised offer restriction", () => {
  for (const language of ["fr", "en"] as const) {
    const e = campaign({
      kind: "specials",
      title: "Lunch offer",
      titleFr: "Offre déjeuner",
      description:
        "10% off lunch. Minimum spend 2000 FCFA. Reservation required.",
      descriptionFr:
        "10 % de remise au déjeuner. Achat minimum 2000 FCFA. Réservation obligatoire.",
    });
    const p = payloadFor(
      e,
      language,
      "standard",
      { name: "NVO", whatsapp: "22950924184", address: "Cotonou" },
      "https://nvo.example",
    );
    const captions = standardCaptions(p);
    assert.equal(new Set(Object.values(captions)).size, 4);
    for (const [platform, caption] of Object.entries(captions)) {
      assert.ok(
        caption.length <= captionLimits[platform as keyof typeof captionLimits],
      );
      assert.ok(caption.includes("2000"));
      assert.ok(caption.includes(`utm_source=${platform}`));
    }
    assert.match(captions.whatsapp, /STOP/);
    assert.ok(!captions.whatsapp.includes("#"));
    const longer = standardCaptions({
      ...p,
      entry: {
        ...e,
        title: "90% off",
        titleFr: "90 % de remise",
        description: "Details. ".repeat(650) + "Minimum 90000 FCFA.",
        descriptionFr: "Détails. ".repeat(650) + "Minimum 90000 FCFA.",
      },
    });
    for (const [platform, caption] of Object.entries(longer)) {
      assert.ok(
        caption.length <= captionLimits[platform as keyof typeof captionLimits],
      );
      assert.ok(!caption.includes("90%"));
      assert.ok(!caption.includes("90 %"));
      assert.ok(caption.includes("conditions"));
    }
  }
});
