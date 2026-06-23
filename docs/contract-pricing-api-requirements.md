# Requirements: Contract Pricing API (for the technical team)

**Date:** 2026-06-23
**Purpose:** A read-only API that exposes **Sage 300 I/C Contract Pricing** to the customer portal, so a logged-in customer can see **their own negotiated contract prices** — what products, at what price, and **for how long** (contract duration).
**Source of truth:** Sage 300 (Inventory Control → Contract Pricing). This API only **reads** from Sage; it never writes. Nothing is stored in the portal database.

> Why a custom API: the standard Sage Web API `ICItemPricing` returns *price-list* pricing, but does **not** expose **customer-specific contract pricing with effective/expiry dates**. That data lives in I/C Contract Pricing and needs a dedicated read endpoint (Sage view / custom Web API extension / read-only SQL — your call).

---

## 1. What the portal needs to show

A customer's "Contract Pricing" page should list each contracted item with:

- **Product** — item number, description (and our catalog SKU / source key).
- **Price** — the contracted amount, currency, and unit of measure; and *how* it's priced (fixed price vs discount % vs cost-plus).
- **Duration** — start (effective) date and end (expiry) date, and whether it's currently **active / upcoming / expired**.
- **Quantity terms** — minimum quantity / quantity-break tiers, if the contract uses them.

## 2. Fields per record (the response contract)

Each contract-pricing row should return (map these to the actual Sage field names from the screenshots):

| Field | Type | Notes |
|---|---|---|
| `customerNumber` | string | Sage A/R customer number (e.g. `MOSCOL1`). |
| `customerName` | string | For display. |
| `itemNumber` | string | Sage formatted item number. |
| `unformattedItemNumber` | string | Sage source key (matches our catalog `sourceKey`). |
| `description` | string | Product name/description. |
| `priceListCode` | string | The price list the contract belongs to. |
| `priceType` | enum | How price is derived: `fixed` / `discountPercent` / `costPlus` / `markup` (use Sage's actual basis). |
| `contractPriceAmount` | number | The contracted unit price (when `priceType = fixed`). |
| `discountPercent` | number \| null | When the basis is a discount/markup %. |
| `currencyCode` | string | e.g. `CAD`. |
| `unitOfMeasure` | string | Pricing unit. |
| `minimumQuantity` | number \| null | Quantity break threshold, if any. |
| `quantityBreaks` | array \| null | If tiered: `[{ minQuantity, price }]`. Optional. |
| `effectiveDate` | date (ISO) | Contract **start** — the "from" of the duration. |
| `expiryDate` | date (ISO) \| null | Contract **end** — the "to" of the duration. `null` = no expiry. |
| `status` | enum | Derived: `active` / `upcoming` / `expired` (relative to today). |

## 3. Filters (query parameters)

The portal must be able to filter the list. **Required** = the portal always sends it; **Recommended** = good to have.

| Param | Req? | Purpose |
|---|---|---|
| `customer` | **Required** | Filter by customer **number or name**. The portal passes the **logged-in customer's number** so a customer only sees *their* contracts. (This is also the security boundary — see §6.) |
| `activeOn` | Recommended | Return only contracts active **as of a date** (default = today). This is the "current contracts only" toggle. |
| `status` | Recommended | `active` / `upcoming` / `expired` / `all`. |
| `search` | Recommended | Free-text on item number / description. |
| `item` / `sku` | Recommended | Filter to a specific product. |
| `priceListCode` | Recommended | Filter by price list. |
| `effectiveFrom`, `effectiveTo` | Optional | Date-range on the start date. |
| `expiryFrom`, `expiryTo` | Optional | Date-range on the end date (e.g. "expiring in the next 30 days"). |
| `page`, `pageSize` | Recommended | Server-side pagination. |
| `sort` | Recommended | e.g. `expiryDate` (soonest-expiring first), `effectiveDate`, `itemNumber`, `price`. Default: **active first, soonest expiry first**. |

## 4. Suggested response shape

```jsonc
{
  "rows": [
    {
      "customerNumber": "MOSCOL1",
      "customerName": "MOSAIC POTASH COLONSAY ULC",
      "itemNumber": "01184217",
      "unformattedItemNumber": "01184217",
      "description": "ALTERNATOR",
      "priceListCode": "RETAIL",
      "priceType": "fixed",
      "contractPriceAmount": 720.00,
      "discountPercent": null,
      "currencyCode": "CAD",
      "unitOfMeasure": "EA",
      "minimumQuantity": 1,
      "quantityBreaks": null,
      "effectiveDate": "2026-01-01",
      "expiryDate": "2026-12-31",
      "status": "active"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 24
}
```

## 5. Sorting & pagination

- **Server-side** pagination (`page`/`pageSize`) and sorting — the portal won't pull the whole table.
- Sensible default order: **active contracts first, then soonest to expire.**

## 6. Non-functional requirements

- **Read-only.** No create/update/delete. Sage remains the system of record.
- **Customer-scoped / secure.** A customer must only see their own contract pricing. Either the API enforces it from the authenticated context, **or** it accepts a trusted `customerNumber` from our server (the portal already authenticates the user and knows their Sage customer number — it would pass that). Do **not** allow a customer to query arbitrary customers.
- **Currency-aware.** Return the contract's currency; don't convert.
- **Stable identifiers.** `unformattedItemNumber` must match our catalog source key so the portal can deep-link to the product page.

## 7. How the portal will consume it

- The existing **"Contract Pricing"** page (sidebar → Procurement → Contract Pricing, route `/rfp`) will render this list.
- The portal calls the custom API server-side, **injecting the logged-in customer's `sage_customer_number`** as the `customer` filter — so the customer never controls which customer's prices they see.
- Admins may call it with any `customer` for support/management.

## 8. Open questions to confirm with the accountant (from the screenshots)

1. **Exact Sage field names** for each field in §2 (especially price basis, effective/expiry dates, and quantity breaks) — so the team maps them correctly.
2. **Price basis types** actually used in your contracts: fixed price? discount %? cost-plus? markup? quantity-tiered?
3. **Where contract pricing is keyed** — per customer? per customer **group**? per price list? (Affects how `customer` filtering must work.)
4. **Expiry handling** — do contracts always have an end date, or can they be open-ended?
5. **Which company/companies** and currency(ies) are in scope.
