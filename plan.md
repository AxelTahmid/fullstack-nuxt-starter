# supplyKey x Sage 300 - Current Integration Plan

## 1. Guiding Principle: Sage Is The Source Of Truth

Sage 300 owns all business data: products, pricing, customer accounts, orders, and quotes. supplyKey is the web application layer on top of it. The database is **not** a mirror of Sage. We do not persist Sage-owned data locally.

**We store data locally only when it does not exist in Sage and is required for the app to function.** Every new table must clear that bar and is approved case by case. Migrations stay one table per migration, and a new migration is added only after explicit approval.

### Local storage allowlist (the only tables we keep)

| Table | Why it must be local | Status |
|---|---|---|
| `users` | Login accounts + role + Sage customer linkage. No Sage equivalent for app auth. | In place |
| `email_auth_tokens` | Magic-link/auth tokens. Auth concern, not Sage. | In place |
| `brand_settings` | App theming/config. Not a Sage concept. | In place |
| `cart_items` | Pre-submission working draft. Becomes a Sage document only at checkout/estimate. | In place |
| `enquiries` | Threaded customer/admin conversation. Sage has no messaging concept. Approved (option A, section 7). | In place |
| `enquiry_messages` | Messages within an enquiry thread. | In place |
| pg-boss tables | Background job queue. Infrastructure, not Sage. | In place |

Anything not on this list lives in Sage and is read/written through the generated SDK. Adding any further table requires the same explicit, case-by-case approval.

### Non-negotiable architecture

- The browser never calls Sage directly.
- Frontend code does not import the Sage SDK or any `server/*` module.
- Server endpoints call the generated Sage SDK methods directly (e.g. `icItemsGet`, `oeOrdersPost`). We do not build a generic utils adapter that wraps SDK request calls.
- Pure, repeated, non-SDK logic (config path, OData escaping, response → DTO mapping) is shared in `server/utils/sage300.ts`.
- API response contracts used by the frontend live in `shared/*`.
- There is no local product / order / quote table as a source of truth.
- Pricing is Sage-owned. Product list pages avoid extra pricing calls; detail, cart, checkout, and estimate flows fetch pricing closer to action.
- A user has role `admin` or `customer`; customer Sage linkage (`sage_customer_number`) belongs on `users`.

## 2. Current Implementation Status

| Area | Status | Notes |
|---|---|---|
| Sage SDK generation | In place | Generated SDK lives under `shared/sage300`; servers use SDK methods directly. |
| Sage client setup | In place | `server/plugins/sage300.ts` configures base URL, auth header, timeout, logging. |
| Shared Sage mappers | In place | `server/utils/sage300.ts` holds pure helpers: `sagePath`, `escapeODataString`, item/order/quote DTO mappers. No SDK wrapping. |
| Product listing | In place | `GET /api/products` calls Sage `ICItems`; returns `ProductListResponse`. |
| Product detail + pricing | In place | `GET /api/products/[sourceKey]` resolves item + `ICItemPricing` (graceful fallback). |
| Cart | In place | `cart_items` table + repository + endpoints. Prices resolve server-side, fall back to `0`. |
| Checkout / order submit | In place | `POST /api/orders` posts `OrderType: "Active"` via `oeOrdersPost`; clears cart on success. No local order tables. |
| Order reads | In place | `GET /api/orders` is **server-paginated** (Sage `$skip`/`$top`/`$count` + OData `contains()` search; route-query `?page&pageSize&search`), rendered on the shared DataTable (server pagination + search) with an Orders sidebar nav. `GET /api/orders/[number]` detail reads Sage `OEOrders`. Quotes excluded; OE list has no `$orderby`, so no column sort. |
| Request estimate (RFQ) | In place | `POST/GET /api/estimates` + `GET /api/estimates/[number]` create/read Sage OE **Quote** documents. No local quote tables. Routes: `/estimate` (server-paginated list on the shared DataTable), `/estimate/new` (request form), `/estimate/[number]` (detail) — shadcn primitives + route-owned `_lib` components; Estimates sidebar nav. |
| Enquiries | In place | Local `enquiries` + `enquiry_messages` tables (migrations 0006/0007). Repository + 5 endpoints back the existing pages. |

## 3. Sage Product Read Model

- `GET /api/products` — requires login, calls `icItemsGet`, supports OData `$filter/$top/$skip/$count`, maps `ICItem → ProductListItem`, returns nullable `priceCents`.
- `GET /api/products/[sourceKey]` — item detail + pricing (`ICItemPricing`), with a graceful "pricing unavailable" path.

Keep this direction. No local product tables for catalog data. Keep page-size pagination; do not scan all Sage items to compute global facet counts.

## 4. Cart (local, by design)

The cart is the one pre-submission working draft we keep, because it is not a Sage document until the user checks out or requests an estimate.

### Schema (already applied — migration `0005_create_cart_items_table`)

```text
cart_items:
  id, user_id -> users(id) cascade, source_key text, quantity int (>0),
  created_at, updated_at, unique(user_id, source_key)
```

The durable cart identity is the Sage item key + quantity. We do not store name, category, image, or price as canonical cart data — those resolve from Sage on read.

### Cart API (implemented)

- `GET /api/cart` — load `cart_items`, resolve item + pricing from Sage, return `CartSummary`. Unresolved prices return `0`.
- `POST /api/cart/items` — validate `cartItemAddSchema`, upsert `user_id + source_key`, increment quantity.
- `PATCH /api/cart/items/[id]` — validate `cartItemUpdateSchema`, quantity `0` deletes, ownership enforced.
- `DELETE /api/cart/items/[id]` — ownership enforced, delete line.

Cart page captures delivery site, contact, requested ship date, carrier preference, and shipping instructions. No live freight calc yet; shipping shows `To be confirmed` until a backend summary returns a non-zero amount.

## 5. Checkout And Sage Order Submit

Checkout converts cart items into a Sage **order** (`OrderType: "Active"`). Separate from request estimate.

Flow (implemented in `POST /api/orders`):

1. Require login + linked `sage_customer_number` (else `400`).
2. Validate cart belongs to user; resolve each Sage item by source key (reject unavailable items).
3. Build an OE order; carrier/shipping fields go into `OrderComment` + `OrderCommentsInstructions`.
4. `oeOrdersPost` creates the order. Sage owns order number, pricing, tax, totals, status, history.
5. Clear cart after success.

Reads:

- `GET /api/orders` — list current user's orders (admin sees all); `OrderType ne 'Quote'`.
- `GET /api/orders/[number]` — single order by `OrderNumber` or `OrderReference`; `OrderType ne 'Quote'`.

No local order/order-item tables. If idempotency becomes a production problem, solve it with a Sage external reference or a short-lived retry guard — never a local order source of truth.

**Open verification:** confirm the Sage `OEOrders` list response includes `OrderDetails` (line items) without `$expand`. The OData list endpoint in the generated SDK exposes `$filter/$select/$top/$skip/$count` but **not** `$expand`. If lines are absent on list reads, switch the detail endpoint to fetch by `OrderUniquifier` (`oeOrdersGetByOrderUniquifier`) after resolving the number. List summaries already avoid this by using `NumberOfLinesOnOrder` for item counts.

## 6. Request Estimate (RFQ) — Sage OE Quote, no local storage

Request estimate is a quote/RFQ workflow, distinct from checkout. It creates a Sage OE **Quote** document. Sage owns the quote number, lines, pricing, expiry, and status.

### Estimate API (implemented)

- `POST /api/estimates` — validate `createEstimateSchema`. Items come from the explicit payload or fall back to the cart. Requires linked `sage_customer_number`. Resolves/validates Sage items, then `oeOrdersPost` with `OrderType: "Quote"` and a 30-day `QuoteExpirationDate`. Project reference / needed-by date / budget range / notes are folded into `OrderComment` + `OrderCommentsInstructions`. Returns `{ quoteNumber }`. Does **not** clear the cart (non-destructive).
- `GET /api/estimates` — list Sage `OEOrders` with `OrderType eq 'Quote'` (customer-scoped; admin sees all) → `EstimateSummary[]`.
- `GET /api/estimates/[number]` — single quote by `OrderNumber`/`OrderReference` with `OrderType eq 'Quote'` → `EstimateDetail`.

Status mapping (`EstimateStatus`): `converted` if `OrderNumberActivatedFromQuot` set, else `expired` if `QuoteExpired`, else `submitted`.

### Remaining work

- Rework `/estimate` from the static asset-class mock into a cart/product-backed request form that posts `createEstimateSchema` and lands on a quote detail view.
- Quote → order conversion in Sage (if/when that workflow is enabled) — read-only surfacing first.
- Optionally open an enquiry thread for discussion after the Sage quote exists (depends on section 7).

## 7. Enquiries — IMPLEMENTED (option A: local tables, approved)

Enquiries are threaded customer/admin conversation. **Sage 300 has no general threaded-messaging concept**, so this is the one feature that cannot be Sage-backed. Local tables were approved as the only option supporting a persistent multi-message thread.

Applied schema (one migration per table):

```text
enquiries (0006_create_enquiries_table):
  id, user_id -> users(id) cascade, enquiry_number text unique, subject text,
  product_sku text null, supplier_name text default 'SupplyKey',
  status text default 'sent', priority text default 'medium',
  source_type text default 'general', source_reference text null,  -- Sage doc linkage (text, since Sage numbers are strings)
  created_at, updated_at (set_updated_at trigger)
indexes: (user_id, updated_at), (status, updated_at), (source_type, source_reference)

enquiry_messages (0007_create_enquiry_messages_table):
  id, enquiry_id -> enquiries(id) cascade, author_user_id -> users(id) set null,
  author_name text, author_role text, body text, attachment_name text null, created_at
index: (enquiry_id, created_at)
```

Implementation: `server/db/repository/enquiry.ts` (singleton repo: list summaries with latest-message preview, find-by-number, list messages, create-with-first-message, add-message, update). All five routes replaced their `501` stubs. Access control: customers see only their own threads; admins see all. Message authorship: `asSupplier` → role `Supplier`/name = supplier; otherwise role `Buyer`/name = current user (matches the page's buyer-vs-supplier alignment). Statuses reuse the shared enum (`sent/received/reviewing/responded/resolved`). Quote linkage is available via `source_type = 'quote'` + `source_reference` = Sage quote number (columns present; not yet wired into the estimate flow).

## 8. Customer And Sage Linkage

`users` already has `role`, `sage_customer_number`, `sage_customer_name`. Keep it; do not add a separate customer table unless multiple login users must map to one Sage customer account.

Rules:

- Customers can browse products without a Sage link (if public-after-login catalog is allowed).
- Checkout **and** estimate require `sage_customer_number` (both create Sage documents that are keyed to a customer).
- Unlinked customers cannot create Sage quotes; their RFQ-style needs fall to enquiries/email follow-up (section 7).
- Auto-creating a Sage AR customer happens only after verified email + explicit business approval.

## 9. Product Images

Sage may not be a reliable image store. v1: no image schema; keep `imageUrl: null` until a confirmed Sage field or external image source (object storage keyed by Sage item number) is chosen.

## 10. API Surface Summary

Implemented:

- `GET /api/products`, `GET /api/products/[sourceKey]`
- `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/[id]`, `DELETE /api/cart/items/[id]`
- `POST /api/orders`, `GET /api/orders`, `GET /api/orders/[number]`
- `POST /api/estimates`, `GET /api/estimates`, `GET /api/estimates/[number]`, `POST /api/estimates/[number]/convert`
- `GET/POST /api/enquiries`, `GET /api/enquiries/[number]`, `POST /api/enquiries/[number]/messages`, `PATCH /api/enquiries/[number]`

Pending (no new storage):

- _All planned Sage-backed endpoints are implemented._ Quote → order conversion uses Sage's `CreateOrderFromQuotes` process command on `OEOrders` (no SDK regeneration); the exact field combo (`QuoteNumber`/`QuoteUniquifier`, `PerformMultipleQuotesToOrder`) needs one verification run against the real install.

## 11. Build Order

### Phase 0 — Done

SDK generation, Nitro Sage client, backend product list, shop page rework.

### Phase 1 — Cart — Done

`cart_items` migration, Kysely types, repository, CRUD endpoints, `GET /api/cart` with Sage resolution.

### Phase 2 — Checkout — Done

`POST /api/orders` (Sage `oeOrdersPost`), cart clearing, `GET /api/orders/[number]`, `GET /api/orders` list. Shared Sage mappers extracted to `server/utils/sage300.ts`. `/orders` list page (shadcn primitives + `_lib`: `OrderListRow`, `OrderStatusBadge`, `format.ts`) + Orders sidebar nav; detail back-link points to `/orders`. (Verify list-response `OrderDetails` against the real install — section 5.)

### Phase 3 — Request Estimate — Backend done, frontend pending

- [x] `POST /api/estimates` with direct `oeOrdersPost` + `OrderType: "Quote"`.
- [x] `GET /api/estimates`, `GET /api/estimates/[number]` (direct Sage reads).
- [x] Shared `estimate` types + `createEstimateSchema`.
- [x] Estimate UI on shadcn primitives + route-owned `_lib` (`EstimateLineItem`, `EstimateStatusBadge`, `EstimateStatCard`, `EstimateListRow`, `format.ts`): `/estimate` (list, `GET /api/estimates`), `/estimate/new` (cart-backed request form), `/estimate/[number]` (quote detail). Estimates sidebar nav; dashboard quick-action → `/estimate/new`.
- [x] Quote → order conversion: `POST /api/estimates/[number]/convert` (Sage `CreateOrderFromQuotes` process command on `OEOrders`, no SDK regeneration) + "Convert to order" action on the quote detail; converted quotes link to the resulting order. Exact Sage field combo to verify on first real run.

### Phase 4 — Enquiries — Done (option A)

- [x] `enquiries` (0006) + `enquiry_messages` (0007) migrations applied; `server/db/types.ts` regenerated.
- [x] `enquiry` repository + registered in `repository/index.ts`.
- [x] All five routes replaced their `501` stubs (list, create, thread, patch, post message).
- [x] Verified: server + shared typecheck, lint, and a DB smoke test (schema, FKs, `updated_at` trigger, summary query).
- [ ] (Optional) link a thread to a Sage quote from the estimate flow via `source_type/source_reference`.

### Phase 5 — Pricing And Contract Detail

- [x] Product detail route/page with `ICItemPricing`.
- [ ] Verify `ICItemPricing` availability in the real Sage install.
- [ ] If contract-pricing duration is required, confirm a custom Sage endpoint or read-only Sage SQL.
- Keep list pages fast; fetch detailed pricing only on detail/cart/checkout/estimate review.

## 12. Important Open Decisions

1. ~~Enquiries storage~~ — **Resolved:** option A (local tables), implemented. Section 7.
2. Cart/quote totals: display zero/unknown until Sage returns them, or make `unitPriceCents` nullable in shared contracts?
3. Does the Sage `OEOrders` list response include `OrderDetails` without `$expand`? If not, fetch order/quote detail by `OrderUniquifier`.
4. Does the target Sage install expose `ICItemPricing` in Swagger reliably?
5. Which Sage OE fields should carry estimate/project notes beyond `OrderComment` + comments/instructions?
6. What field/source should provide product images?
7. **Server pagination (verify on real install):** confirm the OE list honours `$count` and returns `@odata.count` (the list endpoints fall back to cursor-style paging when it is absent), and that OData `contains()` is the correct search function for this install (OData v3 would need `substringof`). The OE list exposes no `$orderby`, so list column sorting is intentionally omitted.

## 13. Sources

- [Sage300-SDK](https://github.com/SageNADev/Sage300-SDK)
- [Sage 300 Web API endpoint reference](https://acutedata.com/pdf/sage-300/Sage-300-Web-API-Endpoint-Reference.pdf)
- [I/C Contract Pricing screen](https://help.sage300.com/en-us/2024/classic/Content/Operations/Inventory/ItemsAndPriceLists/SCREENS/ContractPricing.htm)
- [IC Item Pricing API discussion](https://communityhub.sage.com/us/sage300/f/general-discussion/151277/ic-item-pricing-api)
- [Web API order-entry examples](https://communityhub.sage.com/us/sage300/f/general-discussion/156859/help---using-the-web-api-to-generate-prepaid-orders)
