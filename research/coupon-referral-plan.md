# Coupon, drop and referral rules

Status: proposed product specification, based on the full brief and final coupon note. Examples are illustrative, not active offers. All amounts, limits and durations must be owner-configurable.

## Four independent clocks

| Control | Meaning | Example |
| --- | --- | --- |
| Campaign schedule | When the overall campaign is announced and enabled | Starts next Monday; lasts four weeks |
| Drop/claim window | When an eligible visitor may claim a reward | A random five-minute drop on each selected day |
| Activation delay | How long a claimed reward waits before it can be used | Becomes redeemable three days after claiming |
| Redemption validity | How long the issued reward remains usable | Fourteen days after activation, or no expiry if expressly selected |

Keep campaign announcement, claim window and reward visibility separate. A campaign can be announced now, run its first drop in a week, and issue rewards with delayed activation. A claimed reward should normally remain visible in the customer's wallet with an availability date. If the owner wants a reveal delay, show a truthful “Reward pending reveal” receipt instead of silently hiding evidence of the claim. Never reset timers on page refresh.

## Campaign builder

Start with understandable presets and offer advanced settings. Staff should see a plain-language summary and customer preview before publishing.

| Group | Configurable rules |
| --- | --- |
| Campaign | Name, public description, translations, status, announcement date, start/end, timezone |
| Timing | Fixed times, recurring days, or randomized times within allowed service periods; occurrences per week; claim-window duration |
| Reward | Percentage off, fixed FCFA amount, free specified item, complimentary add-on or delivery benefit |
| Economics | Minimum eligible spend, maximum discount, eligible products/categories/variants, campaign budget, redemption capacity |
| Limits | Total claims, claims per drop, claims per customer per business day/week/campaign, redemption limits |
| Eligibility | Everyone, new verified customer, returning customer, referral recipient, approved audience |
| Redemption | Activation delay, expiry basis, maximum lifetime, explicit no-expiry option, dine-in/pickup/delivery applicability |
| Display | Public campaign announcement; show exact next start or a broad availability period; delayed reward reveal if chosen |
| Referral | Friend offer, referrer reward, invitation deadline basis, qualifying outcome, per-referrer cap |
| Controls | Pause new claims, resume, end, duplicate as a new version, explicit audited revocation where necessary |

Avoid arbitrary executable rules. Use a typed rule schema with validation and supported combinations. Contradictions such as expiry before activation, negative prices, free undefined meals, or a drop outside the campaign interval must be rejected before publication.

“Five coupons per week” is ambiguous: five drop events, five total successful claims, or five coupons per person are different settings. Expose each separately. Similarly, “three or four people” belongs to the number of claimants, not automatically to the number of redemptions per customer.

## Public states

| State | What the customer sees |
| --- | --- |
| Not announced | No public campaign entry |
| Announced, not started | Campaign is coming; truthful start information |
| Active campaign, no open drop | Coupon drops are active; there is no claimable offer right now |
| Drop open | Reward, clear terms, actual remaining claim time and a claim action |
| Claimed today | Personal saved reward and when it can be used; visible for the rest of the day and in the wallet afterwards |
| Limit reached | Personal limit reached; explain the applicable period |
| All claimed | This drop's capacity has been reached |
| Waiting for activation | Already claimed; available from an explicit date/time |
| Ready to redeem | Reward code/card, terms and use action |
| Redeemed today | “Used today” only after confirmed redemption |
| Expired / paused / ended | Accurate state; preserve a customer's valid issued reward unless explicitly revoked |

Keep the campaign notice easy to find without interrupting menu browsing. Do not force users to refresh the page constantly. Poll modestly while the offers page is open and synchronize against server time; do not announce every countdown second to screen readers.

## Claim and wallet flow

1. Visitor opens an offer page. The server returns public eligibility and actual timing.
2. The customer chooses Claim. Normal menu browsing does not require an account.
3. For a genuinely enforced per-person limit, verify a customer identity, preferably phone ownership through an approved OTP provider or staff-assisted verification. A typed phone number or browser cookie is insufficient. Until verification is connected, clearly label any session-only limit as such and disable high-value public giveaways.
4. In one database transaction, validate status, schedule, identity, caps and budget, then issue exactly one reward. Unique constraints and an idempotency key prevent double claims from repeated taps or network retries.
5. Display the wallet/card. Permit download and copy. The downloaded card contains an opaque code/QR, reward, activation/expiry, terms and a restaurant identifier; it is not itself proof of a valid unused reward.
6. At checkout or in the restaurant, the server checks the live reward record. Staff confirms redemption against the order. The same reward cannot be redeemed twice.

Do not encode personal data or discounts that the client can edit in a QR URL. Separate the public referral code, customer wallet authentication and redemption code. A guessed wallet URL must never reveal another customer's offers.

## Referral flow and the five-minute ambiguity

The main brief says five minutes to claim after a friend opens a link. The final note suggests opening and ordering within five minutes of generating it. Support distinct presets rather than silently choosing one interpretation.

| Preset | Timer begins | Required within window | Reward consequence |
| --- | --- | --- | --- |
| Recommended: friend claim | First eligible human visit, recorded server-side | Friend claims the offer | Friend saves an offer; referrer reward waits for a qualifying completed order |
| Invitation expiry | Server creates invitation | Friend opens and claims it | Invitation cannot be reused after expiry |
| Strict order-intent window | Selected server-side invitation/visit start | Server records a valid priced order request | Intent qualifies for a hold; reward still waits for staff-confirmed fulfillment |

Messaging app link-preview bots must not start a person's claim timer. Use a user-initiated claim-session action when needed. Timers are bound to the same invite/recipient record and survive reloads; they must not silently restart with each request.

Proposed business rule: friend gets an eligible first-order offer; referrer earns a separate reward after that first order is fulfilled and payment is confirmed by staff. Qualification must occur only once per eligible new customer. Prevent direct self-referral and repeated rewards for the same order; flag suspicious patterns for review without pretending device recognition proves identity.

The website cannot observe whether an ordinary WhatsApp prefilled message was sent, received or paid. Add an order reference to the message and a staff order ledger. Clicking WhatsApp creates an intent event; authorized staff recording a fulfilled/paid outcome creates a sale and can release the reward. Staff reversals/cancellations must be audited and handle pending rewards explicitly.

## Checkout, capacity and concurrency

Owner clarification: prices can be hidden or absent under admin control. Quote-request carts must not show an invented grand total or expose hidden prices through calculated savings. Preserve coupon eligibility/claim records, then validate monetary conditions against the staff-confirmed quote before redemption. Fixed/free-item benefits can be described without displaying private prices. See the price-visibility rules in [the website plan](website-plan.md).

Recalculate prices, availability, eligible subtotal and discounts on the server. The browser submits item IDs, variants, quantities and a coupon token, never an authoritative total. Define rounding to whole FCFA. Default to one order coupon and no promotion stacking until the owner selects explicit rules.

Separate reward issuance from redemption inventory. Decide when a reward reserves campaign liability: recommended at claim for limited free meals, so every valid claim can be honored. A short checkout hold prevents the same reward being used on simultaneous orders; abandoned holds expire without marking it redeemed. Redemption uses an atomic transition and an order reference.

Use a single persisted schedule for randomized drops. Do not generate a new schedule on each page load. Store the chosen window, rule version and business timezone, and do not disclose future hidden timestamps through public APIs. If a scheduled worker misses an entire drop, record it as missed and notify staff; do not silently extend the offer or fabricate claims.

Each issued reward stores a snapshot of its terms. Editing a campaign affects future claims by default. Pausing stops new claims, while honoring already issued offers. An emergency revoke action needs an explicit reason, staff authorization and a visible explanation for affected customers. No browser-only flags may enable or disable a real campaign.

## Proposed launch experiments

| Experiment | Reason to try | Measurement |
| --- | --- | --- |
| Small lunch drop in an owner-selected slow period | Encourage incremental visits at useful times | Fulfilled discounted orders and contribution after food/delivery/reward costs |
| Friend's first order + delayed referrer reward | Acquire a customer and encourage a second visit | Confirmed new customers, referrer return orders and abuse/rejection rate |
| Meal plus add-on offer | Make value understandable while limiting cost | Average order value and contribution versus comparable non-offer orders |
| Occasional free named meal with a hard claim cap | Trial and brand engagement | Claim-to-redemption and later paid repeat orders |

Examples such as 10% off or five claims are configuration illustrations, not recommended margins without food-cost data. Record a baseline and compare similar service periods. Do not claim causation from a small before/after sample. Revisit campaigns after enough completed orders rather than optimizing around clicks alone.

## Acceptance scenarios

Test midnight in the business timezone, boundary seconds, delayed activation, no-expiry rewards, paused campaigns, version changes, product exclusions, free-item quantities, one claimant in two tabs, many users competing for the last reward, failed claim responses followed by retries, offline countdowns, stale cached pages, copied reward images, repeated redemption attempts, self-referral, link-preview bots, cancellation/reversal and unauthorized staff actions.
