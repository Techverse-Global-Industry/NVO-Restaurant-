"use client";
import { useEffect, useState } from "react";
import {
  Search,
  Ticket,
  CheckCircle2,
  Plus,
  Trash2,
  ReceiptText,
} from "lucide-react";
import { api } from "./provider";
import type { Coupon } from "./coupons";
type ClaimRow = {
  code: string;
  title: string;
  status: string;
  id: string;
  claimant_name?: string;
  claimed_at?: string;
  saved_at?: string;
  order_id?: string;
};
type SaleItem = {
  name: string;
  mealId?: string;
  quantity: number;
  unitPrice: number;
};
type Receipt = {
  id: string;
  total: number;
  discount: number;
  subtotal: number;
  reference: string;
  name: string;
  created_at: string;
  items: SaleItem[];
};
export function CouponDesk({
  rewards,
  onChanged,
}: {
  rewards: ClaimRow[];
  onChanged: () => Promise<unknown>;
}) {
  const [code, setCode] = useState("");
  const [search, setSearch] = useState("");
  const [reward, setReward] = useState<Coupon | null>(null);
  const [meals, setMeals] = useState<
    { id: string; title: string; price?: number | null }[]
  >([]);
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [items, setItems] = useState<SaleItem[]>([
    { name: "", quantity: 1, unitPrice: 0 },
  ]);
  const [paid, setPaid] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [quote, setQuote] = useState<{
    subtotal: number;
    discount: number;
    total: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const value = new URLSearchParams(location.search).get("coupon");
    if (value) {
      setCode(value);
      void lookup(value);
    }
  }, []);
  async function lookup(value: string) {
    setBusy(true);
    setError("");
    setReward(null);
    setQuote(null);
    setReceipt(null);
    setPaid(false);
    setReference("");
    setItems([{ name: "", quantity: 1, unitPrice: 0 }]);
    try {
      const data = await api("admin/coupon", { code: value });
      setReward(data.reward);
      setName(data.reward.claimant_name || "");
      setMeals(data.meals);
      setReceipt(data.receipt);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function update(index: number, patch: Partial<SaleItem>) {
    setItems((old) =>
      old.map((i, n) => (n === index ? { ...i, ...patch } : i)),
    );
    setQuote(null);
    setPaid(false);
  }
  const eligible =
    reward?.status === "claimed" &&
    Date.parse(reward.active_at) <= Date.now() &&
    Date.parse(reward.expires_at) > Date.now();
  const payload = { code: reward?.code, name, reference, items, paid: true };
  return (
    <div className="coupon-desk admin-panel" id="coupon-desk">
      <div className="desk-heading">
        <div className="desk-icon">
          <Ticket size={28} />
        </div>
        <div>
          <span className="eyebrow">NVO GUEST PRIVILEGES</span>
          <h2>Check a coupon. Welcome your guest.</h2>
          <p>
            Find the card by its unique code, check the name, then record the
            paid sale.
          </p>
        </div>
      </div>
      <form
        className="coupon-search form"
        onSubmit={(ev) => {
          ev.preventDefault();
          void lookup(code);
        }}
      >
        <label>
          Coupon code
          <input
            placeholder="NVO-…"
            required
            maxLength={50}
            value={code}
            onChange={(ev) => setCode(ev.target.value.toUpperCase())}
          />
        </label>
        <button className="button" disabled={busy}>
          <Search size={17} />
          Check coupon
        </button>
      </form>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {reward && (
        <div className="coupon-verification">
          <div className="verified-guest">
            <span className="status-pill">{reward.status}</span>
            <h3>
              {reward.claimant_name ||
                "Legacy coupon · confirm the guest's name"}
            </h3>
            <strong>{reward.title}</strong>
            <code>{reward.code}</code>
            <p>
              Claimed: {new Date(reward.claimed_at).toLocaleString()}
              <br />
              Active: {new Date(reward.active_at).toLocaleString()}
              <br />
              Expires: {new Date(reward.expires_at).toLocaleString()}
            </p>
            <p>{reward.offer?.description}</p>
            <p>
              Minimum spend: {reward.offer?.minOrder || 0} FCFA
              {reward.offer?.maxDiscount
                ? ` · Maximum discount: ${reward.offer.maxDiscount} FCFA`
                : ""}
            </p>
            <small>
              Check the name with the guest and the code on their card.
            </small>
          </div>
          {eligible && !receipt ? (
            <form
              className="form counter-sale"
              onSubmit={async (ev) => {
                ev.preventDefault();
                setBusy(true);
                setError("");
                try {
                  if (!quote) {
                    setQuote(await api("admin/coupon-quote", payload));
                  } else {
                    const result = await api("admin/redeem", {
                      ...payload,
                      paid,
                    });
                    setReceipt(result.receipt);
                    setReward({ ...reward, status: "redeemed" });
                    await onChanged();
                  }
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h3>
                <ReceiptText size={20} />
                The guest’s sale
              </h3>
              <label>
                Name on the coupon
                <input
                  required
                  maxLength={80}
                  value={name}
                  onChange={(ev) => {
                    setName(ev.target.value);
                    setQuote(null);
                    setPaid(false);
                  }}
                />
              </label>
              <p className="form-note">
                Enter the dishes and actual unit prices on this sale. The
                discount is calculated from the terms saved when the coupon was
                claimed.
              </p>
              {items.map((item, index) => (
                <div className="sale-line" key={index}>
                  <label>
                    Dish
                    <select
                      aria-label={`Dish ${index + 1}`}
                      value={item.mealId || ""}
                      onChange={(ev) => {
                        const m = meals.find((m) => m.id === ev.target.value);
                        update(index, {
                          mealId: m?.id,
                          name: m?.title || "",
                          unitPrice: m?.price || 0,
                        });
                      }}
                    >
                      <option value="">Other receipt item</option>
                      {meals.map((m) => (
                        <option value={m.id} key={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={`Item ${index + 1} description`}
                      required
                      maxLength={120}
                      value={item.name}
                      onChange={(ev) =>
                        update(index, { name: ev.target.value })
                      }
                      placeholder="Name on the receipt"
                    />
                  </label>
                  <label>
                    Qty
                    <input
                      required
                      type="number"
                      min={1}
                      max={30}
                      value={item.quantity}
                      onChange={(ev) =>
                        update(index, { quantity: Number(ev.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Unit price · FCFA
                    <input
                      required
                      type="number"
                      min={0}
                      max={10000000}
                      value={item.unitPrice}
                      onChange={(ev) =>
                        update(index, { unitPrice: Number(ev.target.value) })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    disabled={items.length === 1}
                    aria-label={`Remove item ${index + 1}`}
                    onClick={() => {
                      setItems(items.filter((_, i) => i !== index));
                      setQuote(null);
                      setPaid(false);
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="underlined"
                disabled={items.length >= 40}
                onClick={() => {
                  setItems([...items, { name: "", quantity: 1, unitPrice: 0 }]);
                  setQuote(null);
                  setPaid(false);
                }}
              >
                <Plus size={16} />
                Add a dish
              </button>
              <label>
                Till receipt number · optional
                <input
                  maxLength={100}
                  placeholder="If you already issued a receipt"
                  value={reference}
                  onChange={(ev) => setReference(ev.target.value)}
                />
              </label>
              <p className="form-note">
                NVO creates a unique sale reference automatically. Add your till
                receipt number if you also use a cash register.
              </p>
              {quote && (
                <>
                  <dl className="sale-total">
                    <div>
                      <dt>Food subtotal</dt>
                      <dd>{quote.subtotal.toLocaleString()} FCFA</dd>
                    </div>
                    <div>
                      <dt>Coupon discount</dt>
                      <dd>−{quote.discount.toLocaleString()} FCFA</dd>
                    </div>
                    <div>
                      <dt>Amount to collect</dt>
                      <dd>{quote.total.toLocaleString()} FCFA</dd>
                    </div>
                  </dl>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={paid}
                      required
                      onChange={(ev) => setPaid(ev.target.checked)}
                    />
                    I checked the guest’s name and received the amount shown.
                  </label>
                </>
              )}
              <button className="button" disabled={busy || (!!quote && !paid)}>
                {busy
                  ? "Checking…"
                  : quote
                    ? "Record paid sale & use coupon"
                    : "Calculate the guest’s discount"}
              </button>
            </form>
          ) : (
            !receipt && (
              <p className="notice">
                {reward.status === "held"
                  ? "This coupon belongs to an open website order. Complete or cancel that order first."
                  : reward.status === "redeemed"
                    ? "This coupon has already been used. It cannot be used a second time."
                    : Date.parse(reward.active_at) > Date.now()
                      ? "This coupon is not active yet."
                      : "This coupon has expired."}
              </p>
            )
          )}
          {receipt && (
            <div className="counter-receipt" role="status">
              <CheckCircle2 size={30} />
              <h3>Paid sale recorded</h3>
              <strong>{receipt.id}</strong>
              <p>
                {receipt.name} · {new Date(receipt.created_at).toLocaleString()}
              </p>
              {receipt.items.map((i, n) => (
                <p key={n}>
                  {i.quantity} × {i.name} ·{" "}
                  {(i.quantity * i.unitPrice).toLocaleString()} FCFA
                </p>
              ))}
              <p>Discount: {receipt.discount.toLocaleString()} FCFA</p>
              <h3>Paid: {receipt.total.toLocaleString()} FCFA</h3>
              {receipt.reference && <p>Till receipt: {receipt.reference}</p>}
              <small>This coupon is now marked as used.</small>
            </div>
          )}
        </div>
      )}
      <div className="claim-register">
        <h3>Claimed coupon register</h3>
        <label>
          Find a name or code
          <input
            type="search"
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
            placeholder="Guest name or NVO code"
          />
        </label>
        <div className="claim-register-list">
          {rewards
            .filter((r) =>
              `${r.claimant_name || ""} ${r.code} ${r.title}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => {
                  setCode(r.code);
                  void lookup(r.code);
                  document
                    .getElementById("coupon-desk")
                    ?.scrollIntoView({ behavior: "instant" });
                }}
              >
                <span>
                  <strong>{r.claimant_name || "Guest · older coupon"}</strong>
                  <small>{r.title}</small>
                  <code>{r.code}</code>
                </span>
                <span>
                  <b className="status-pill">{r.status}</b>
                  <small>
                    {r.claimed_at
                      ? new Date(r.claimed_at).toLocaleDateString()
                      : ""}
                    {r.saved_at ? " · Card downloaded" : ""}
                  </small>
                </span>
              </button>
            ))}
        </div>
        {!rewards.length && (
          <p className="form-note">
            Names, claim dates and download records appear here as guests claim
            their cards.
          </p>
        )}
      </div>
    </div>
  );
}
