# supplyKey x Sage 300 - Current Integration Plan

## 1. Current Direction

Sage 300 is the source of truth for products, pricing, customer account data, and submitted sales documents. supplyKey is the web application layer: authenticated users browse Sage inventory through backend endpoints, build local working carts, request estimates, manage enquiry threads, and submit orders or quote requests through server-side Sage calls.

Non-negotiable architecture:

- The browser never calls Sage directly.
- Frontend code does not import Sage SDK methods or server code.
- Server endpoints call the generated Sage SDK directly. Avoid a generic utils adapter around SDK calls.
- API response contracts used by the frontend stay in `shared/*`.
- There is no local product table as source of truth. Product list/detail data comes from Sage.
- Pricing is Sage-owned. Product list pages should avoid extra pricing calls; product detail, cart, checkout, or estimate flows can fetch pricing when the user is closer to action.
- Users are loginable accounts. A user has role `admin` or `customer`; customer Sage linkage belongs on `users`.
- Migrations stay one table per migration.

## 2. Current Implementation Status

| Area | Status | Notes |
|---|---|---|
| Sage SDK generation | In place | Generated SDK lives under `shared/sage300`; server uses SDK methods such as `icItemsGet` directly. |
| Sage client setup | In place | `server/plugins/sage300.ts` configures generated client base URL, auth header, timeout, and logging. |
| Product listing | In place | `GET /api/products` calls Sage `ICItems` from the backend and returns `ProductListResponse`. |
| Product filters | Partial | Category/manufacturer filters use current Sage page results for facet values. Counts are no longer shown in the UI. |
| Product pricing | Deferred | `ProductListItem.priceCents` is nullable. No list-page pricing call. |
| Local product repository | Deprecated | Product-related UI should not depend on local DB products. |
| Users/auth schema | In place | Current core tables: `users`, `email_auth_tokens`, `brand_settings`, plus pg-boss tables. |
| Cart | In place | `cart_items` migration, Kysely type, repository, and cart endpoints are implemented. Prices resolve server-side when available and fall back to `0`. |
| Checkout/order submit | Stubbed | `POST /api/orders` returns `501`. |
| Enquiries | Stubbed | Shared schemas/types and pages exist, but API routes return `501` because schema was removed. |
| Request estimate | Static UI | `/estimate` is not yet backed by API/schema. |

## 3. Sage Product Read Model

Current product list behavior:

- `GET /api/products`
- Requires logged-in user.
- Calls generated SDK method `icItemsGet`.
- Supports OData `$filter`, `$top`, `$skip`, `$count`.
- Maps Sage `ICItem` into `ProductListItem`.
- Returns nullable `priceCents`.

Keep this direction. Do not reintroduce local product tables for catalog data.

Short-term product improvements:

1. Add `GET /api/products/[sourceKey]` for detail pages.
2. Fetch pricing only on product detail, cart, checkout, or estimate review.
3. If Sage has reliable item images/attachments in this installation, expose `imageUrl`; otherwise use a separate image strategy keyed by Sage item number.
4. Keep page-size pagination. Avoid scanning all Sage items just to compute global facet counts.

## 4. Cart Planning

Cart should be local and lightweight because it is a user working draft, not a Sage document.

### Schema

Add one migration:

```sql
cart_items:
  id bigint identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  source_key text not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  unique(user_id, source_key)
```

Indexes:

- `cart_items(user_id)`
- unique `(user_id, source_key)`

Do not store product name, category, image, or price as the canonical cart value. The durable cart identity is the Sage item key plus quantity.

### API

- `GET /api/cart`
  - Load current user's `cart_items`.
  - Resolve item details from Sage by item number/source key.
  - Return `CartSummary`.
  - If pricing is not available from a cheap Sage endpoint, return price fields as `0` or make shared cart price fields nullable before implementing.

- `POST /api/cart/items`
  - Validate `cartItemAddSchema`.
  - Upsert `user_id + source_key`, incrementing quantity if item already exists.
  - Optionally validate the Sage item exists before insert. Prefer validation for correctness, but batch or cache if latency becomes painful.

- `PATCH /api/cart/items/[id]`
  - Validate `cartItemUpdateSchema`.
  - Quantity `0` deletes the line.
  - Ensure row belongs to current user.

- `DELETE /api/cart/items/[id]`
  - Ensure row belongs to current user.
  - Delete line.

### UI Flow

1. Customer clicks `Add` on the shop card.
2. `useCart.addItem(product.sourceKey, 1)` calls `POST /api/cart/items`.
3. `useCart.refresh()` calls `GET /api/cart`.
4. Header/cart badge updates from returned summary.
5. Customer navigates to `/cart`.

The product card button can stay as-is once the backend endpoint is implemented.

## 5. Checkout And Sage Order Submit

Checkout is for converting cart items into a Sage order. It is separate from request estimate.

Recommended v1 behavior:

1. Customer reviews cart.
2. Customer enters PO number, delivery site, notes, and desired shipping instructions.
3. Server validates the cart belongs to the current user and resolves Sage item details.
4. Server creates an OE order in Sage using the generated SDK method for `OEOrders`.
5. Sage returns authoritative prices/taxes/totals.
6. supplyKey stores a local order receipt record for display and history.
7. Cart is cleared only after successful Sage order creation.

Because Sage `OEOrders` POST is not naturally idempotent, use a local order/outbox record before pushing if reliability matters. For the first implementation, a direct server-side Sage POST can work if the UI clearly reports failures and does not clear cart on failure.

### Order Schema

Add later, one table per migration:

```sql
orders:
  id bigint identity primary key,
  user_id bigint not null references users(id),
  order_number text not null unique,
  sage_order_number text null unique,
  status text not null,
  subtotal_cents integer not null default 0,
  shipping_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  payment_method text not null,
  po_number text null,
  delivery_site text not null,
  carrier text null,
  sage_payload jsonb null,
  sage_response jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null
```

```sql
order_items:
  id bigint identity primary key,
  order_id bigint not null references orders(id) on delete cascade,
  source_key text not null,
  sku text not null,
  name text not null,
  unit_price_cents integer not null default 0,
  quantity integer not null check (quantity > 0),
  line_total_cents integer not null default 0,
  created_at timestamptz not null default now()
```

Optional reliability table:

```sql
sage_order_outbox:
  id bigint identity primary key,
  order_id bigint not null unique references orders(id) on delete cascade,
  status text not null,
  attempts integer not null default 0,
  last_error text null,
  pushed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null
```

## 6. Request Estimate

Request estimate is not checkout. It is a quote/RFQ workflow for cases where pricing, logistics, availability, or substitutions need human/vendor review.

Use cases:

- Customer wants pricing before committing.
- Customer wants a volume quote for cart items.
- Customer needs non-catalog requirements, delivery constraints, or compliance notes.
- Customer wants a quote that may later become a Sage order.

### Estimate Model

Add one table per migration:

```sql
estimate_requests:
  id bigint identity primary key,
  user_id bigint not null references users(id),
  estimate_number text not null unique,
  enquiry_id bigint null,
  status text not null,
  project_name text null,
  needed_by date null,
  delivery_site text null,
  budget_min_cents integer null,
  budget_max_cents integer null,
  notes text not null default '',
  sage_quote_number text null,
  submitted_at timestamptz null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null
```

```sql
estimate_request_items:
  id bigint identity primary key,
  estimate_request_id bigint not null references estimate_requests(id) on delete cascade,
  source_key text not null,
  sku text not null,
  name text not null,
  quantity integer not null check (quantity > 0),
  unit_of_measure text null,
  notes text null,
  created_at timestamptz not null default now()
```

Add FK from `estimate_requests.enquiry_id` after the `enquiries` table exists.

Statuses:

- `draft`
- `submitted`
- `reviewing`
- `quoted`
- `accepted`
- `declined`
- `cancelled`

### Estimate API

- `POST /api/estimates`
  - Creates estimate from explicit item payload or from current cart.
  - Snapshots current Sage item names/SKUs for readability.
  - Creates a linked enquiry thread automatically.
  - Does not create a Sage OE order.

- `GET /api/estimates`
  - Lists current user's estimates; admins can list all.

- `GET /api/estimates/[number]`
  - Returns estimate detail, item snapshots, linked enquiry status.

- `POST /api/estimates/[number]/submit`
  - Moves draft to submitted.
  - Opens/updates linked enquiry thread.

- `POST /api/estimates/[number]/create-sage-quote`
  - Admin-only.
  - Optional later step if Sage quote-type OE orders are confirmed in the target installation.
  - Stores `sage_quote_number`.

### UI Flow

1. Customer selects products from shop or cart.
2. Customer clicks `Request estimate`.
3. Estimate form asks for quantity, needed date, delivery site, project notes, and optional budget range.
4. Submission creates an estimate and linked enquiry.
5. Customer lands on the enquiry/estimate detail page.
6. Admin/customer continue discussion in the enquiry thread.
7. Admin can convert the estimate into a Sage quote or ask the customer to proceed to checkout.

## 7. Enquiries

Enquiries are the threaded communication system. They should back both general questions and estimate discussions.

Existing shared contracts:

- `shared/types/enquiry.ts`
- `shared/schemas/enquiry.ts`
- Pages under `app/pages/enquiries`

Current API routes are stubbed because the schema was removed. Rebuild the schema around the existing shared contracts, but add enough linkage for estimates/orders.

### Schema

```sql
enquiries:
  id bigint identity primary key,
  user_id bigint not null references users(id),
  enquiry_number text not null unique,
  subject text not null,
  product_sku text null,
  supplier_name text not null default 'SupplyKey',
  status text not null,
  priority text not null,
  source_type text not null default 'general',
  source_id bigint null,
  created_at timestamptz not null default now(),
  updated_at timestamptz null
```

```sql
enquiry_messages:
  id bigint identity primary key,
  enquiry_id bigint not null references enquiries(id) on delete cascade,
  author_user_id bigint null references users(id),
  author_name text not null,
  author_role text not null,
  body text not null,
  attachment_name text null,
  created_at timestamptz not null default now()
```

Indexes:

- `enquiries(user_id, updated_at)`
- `enquiries(status, updated_at)`
- `enquiries(source_type, source_id)`
- `enquiry_messages(enquiry_id, created_at)`

Statuses can keep the current shared enum:

- `sent`
- `received`
- `reviewing`
- `responded`
- `resolved`

### API

- `GET /api/enquiries`
  - Customer sees own enquiries.
  - Admin sees all.

- `POST /api/enquiries`
  - Validates `createEnquirySchema`.
  - Creates enquiry and first message in one transaction.

- `GET /api/enquiries/[number]`
  - Enforces access.
  - Returns thread with messages.

- `POST /api/enquiries/[number]/messages`
  - Validates `postMessageSchema`.
  - Adds message.
  - Updates enquiry `updated_at`.

- `PATCH /api/enquiries/[number]`
  - Validates `updateEnquirySchema`.
  - Admin can change status/priority.
  - Customer can mark resolved if allowed.

### Relationship To Estimate

When an estimate is submitted:

- Create `estimate_requests`.
- Create linked `enquiries` row with `source_type = 'estimate'`.
- Create first `enquiry_messages` row from estimate notes.
- Store `estimate_requests.enquiry_id`.

The enquiry thread becomes the customer/admin conversation. Estimate-specific fields stay on `estimate_requests`.

## 8. Customer And Sage Linkage

The current `users` table already has:

- `role`
- `sage_customer_number`
- `sage_customer_name`

Keep that. Do not add a separate customer table unless the business needs multiple login users per one Sage customer account.

User roles:

- `admin`
- `customer`

Rules:

- A customer user can browse products without a Sage link if the business allows public catalog access after login.
- Checkout requires `users.sage_customer_number`.
- Estimate/enquiry can work without a Sage link if admins may manually follow up.
- Creating a Sage AR customer automatically should happen only after verified email and explicit business approval.

## 9. Product Images

Sage may not be a reliable image store depending on the installation. Options:

1. Sage item optional field stores image URL.
2. supplyKey-managed image table keyed by Sage item number.
3. External DAM/object storage keyed by Sage item number.
4. Placeholder image/icon when no image exists.

Recommended v1: add no image schema yet. Keep `imageUrl: null` until a confirmed Sage field or external image source is chosen.

## 10. API Surface Summary

Current:

- `GET /api/products`
- `GET /api/products/[sourceKey]`
- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/[id]`
- `DELETE /api/cart/items/[id]`

Next:

- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/[number]`
- `POST /api/estimates`
- `GET /api/estimates`
- `GET /api/estimates/[number]`
- `POST /api/estimates/[number]/submit`
- `GET /api/enquiries`
- `POST /api/enquiries`
- `GET /api/enquiries/[number]`
- `POST /api/enquiries/[number]/messages`
- `PATCH /api/enquiries/[number]`

## 11. Build Order

### Phase 0 - Already Mostly Done

- Generate Sage SDK with `@hey-api/openapi-ts`.
- Configure Sage client in Nitro plugin.
- Implement backend-only product list route.
- Rework shop page to consume Sage products.

### Phase 1 - Cart

- [x] Add `cart_items` migration.
- [x] Update `server/db/types.ts`.
- [x] Add cart repository.
- [x] Implement cart item add/update/delete endpoints.
- [x] Implement `GET /api/cart` with Sage item resolution.
- [x] Keep shared cart price fields numeric for v1; unresolved prices return `0`.

This unlocks shop add-to-cart and cart page quantity controls.

### Phase 2 - Enquiries

- Add `enquiries` migration.
- Add `enquiry_messages` migration.
- Add repositories.
- Replace enquiry API `501` stubs.
- Keep existing shared schemas/types unless the new source linkage requires additions.

This unlocks the existing enquiries pages.

### Phase 3 - Request Estimate

- Add `estimate_requests` migration.
- Add `estimate_request_items` migration.
- Add estimate repository and API routes.
- Rework `/estimate` from static asset-class UI into cart/product-backed request form.
- Auto-create linked enquiry on submit.

This unlocks RFQ-style workflows without creating Sage orders prematurely.

### Phase 4 - Checkout

- Confirm the target Sage OE order payload from generated SDK and the installation's Swagger.
- Add `orders` and `order_items` migrations.
- Implement `POST /api/orders`.
- Decide direct Sage POST vs outbox before production.
- Write Sage-calculated totals back to local order receipt.
- Clear cart after successful order creation.

### Phase 5 - Pricing And Contract Detail

- [x] Add product detail route/page.
- [ ] Verify `ICItemPricing` availability in the actual Sage install.
- If contract pricing duration is required, confirm whether a custom Sage endpoint or read-only Sage SQL access will provide it.
- Keep list pages fast; fetch detailed pricing only on detail/cart/checkout/estimate review.

## 12. Important Open Decisions

1. Should cart totals display as zero/unknown until checkout, or should `CartLine.unitPriceCents` become nullable?
2. Should checkout create Sage OE orders synchronously, or should it use an outbox from day one?
3. Can customers request estimates without a linked Sage customer number?
4. Does the target Sage installation expose `ICItemPricing` in Swagger?
5. Will estimates create Sage quote-type OE orders, or stay purely local until accepted?
6. What field/source should provide product images?

## 13. Sources

- [Sage300-SDK](https://github.com/SageNADev/Sage300-SDK)
- [Sage 300 Web API endpoint reference](https://acutedata.com/pdf/sage-300/Sage-300-Web-API-Endpoint-Reference.pdf)
- [I/C Contract Pricing screen](https://help.sage300.com/en-us/2024/classic/Content/Operations/Inventory/ItemsAndPriceLists/SCREENS/ContractPricing.htm)
- [Sage 300 2026 release notes](https://help.sage300.com/en-us/2026/classic/Content/ReleaseDocs/ReleaseNotes.htm)
- [IC Item Pricing API discussion](https://communityhub.sage.com/us/sage300/f/general-discussion/151277/ic-item-pricing-api)
- [Web API order-entry examples](https://communityhub.sage.com/us/sage300/f/general-discussion/156859/help---using-the-web-api-to-generate-prepaid-orders)
