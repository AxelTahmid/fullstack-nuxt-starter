# Contract Pricing API - Technical Specification

**Type:** Read-only HTTP/JSON API.
**Backing data:** Sage 300 → Inventory Control → **I/C Contract Pricing**.
**Summary:** Expose customer contract-pricing rows for read/query. The API never writes; Sage is the system of record. Every field maps to a field on the I/C Contract Pricing window ([3.1](#31-field-dictionary)).

---

## 1. Conventions

| Concern | Value |
|---|---|
| Base URL | `{BASE_URL}/api/v1` (placeholder) |
| Resource | `contract-prices` |
| Methods | `GET` only |
| Media type | `application/json` |
| Field casing | `camelCase` |
| Dates | ISO‑8601 date `YYYY-MM-DD`, no time; `null` = unset / open-ended |
| Numbers | JSON decimal; currency carried in `currencyCode`; **never** currency-converted |
| Enums | Stable PascalCase tokens ([4](#4-enumerations)) |
| Auth | Bearer token (or agreed server-to-server scheme), see [9](#9-access-control) |
| Versioning | Path (`/v1`) |
| Freshness | Live Sage read, or mirror - state staleness window if mirrored |

---

## 2. Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/contract-prices` | List / query rows (filter, sort, paginate) |
| `GET` | `/contract-prices/{id}` | Retrieve one row |

No write endpoints.

---

## 3. Data model

### 3.1 Field dictionary

All fields are read-only. Every field except `id` maps to Sage data; **`id`** is an API-generated surrogate - an opaque encoding of the natural key ([3.2](#32-record-identity)). **Key** = the field participates in that natural key. No business fields are derived: there is no status field - consumers compute active/expired from `startDate`/`expirationDate`.

| Sage field (window label) | API field | Type | Flags | Notes |
|---|---|---|---|---|
| - | `id` | string | Key (opaque) | Stable row id ([3.2](#32-record-identity)) |
| Customer Number | `customerNumber` | string | Key | A/R customer number, e.g. `MOSEK31` |
| (customer name) | `customerName` | string | | e.g. `Mosaic Business Services (K3)` |
| (currency) | `currencyCode` | string(3) | | Customer currency, e.g. `CAD` |
| Price by | `priceBy` | enum | Key | `ItemNumber` \| `CategoryCode` |
| Item Number | `itemNumber` | string | Key | Set when `priceBy = ItemNumber`, e.g. `100-16` |
| (item description) | `itemDescription` | string | | e.g. `TOOL BAG (8"D x 16"W x 14"H)` |
| - | `unformattedItemNumber` | string | | Unformatted item key (host-system source key) |
| (Category Code) | `categoryCode` | string | Key | Set when `priceBy = CategoryCode` |
| (category description) | `categoryDescription` | string | | Set when `priceBy = CategoryCode` |
| Price List | `priceListCode` | string | Key | e.g. `CAN` |
| (price list name) | `priceListName` | string | | e.g. `Canada` |
| Pricing Unit | `pricingUnit` | string | Key | Unit of measure, e.g. `EA` |
| Item Pricing By | `itemPricingBy` | enum | | `Quantity` \| `Weight` |
| Contract Price Type | `contractPriceType` | enum | | How the price is derived ([4.2](#42-contractpricetype)) |
| Use Lowest Price | `useLowestPrice` | boolean | | `true` ⇒ lower of contract vs. standard price |
| Customer Type | `customerType` | enum \| null | | `Base`/`A`-`E` when `contractPriceType = CustomerType`; else `null` |
| Calculated Unit Price | `calculatedUnitPrice` | number | | Resolved unit price for the row, e.g. `70.00` |
| Start Date | `startDate` | date \| null | Key | Lock start; `null` = open start |
| Expiration Date | `expirationDate` | date \| null | | Lock end; `null` = no expiry |

`itemNumber` and `categoryCode` are mutually exclusive; exactly one participates in the key per `priceBy`.

### 3.2 Record identity

Natural (composite) key - includes `startDate` so a product can carry a schedule of dated rows ([3.3](#33-dated-rows--schedules)):

```
customerNumber + priceBy + (itemNumber | categoryCode) + priceListCode + pricingUnit + startDate
```

The API also returns a stable opaque `id` (e.g. an encoding of the natural key) for `GET /contract-prices/{id}`. Both resolve to the same row.

### 3.3 Dated rows & schedules

Each row defines a price that holds for the window `[startDate, expirationDate]`:

- `startDate = null` → effective immediately.
- `expirationDate = null` → no expiry (indefinite).

A single `(customer, item/category, price list, unit)` MAY have **multiple rows** with different, non-overlapping windows - a price schedule over time (e.g. `2026-01-01 → 2027-12-31 @ 70.00`, then `2028-01-01 → null @ 72.00`). The API returns these as separate rows; `startDate` distinguishes them in the key. The consumer determines which row is current vs. upcoming vs. past from `startDate`/`expirationDate`.

---

## 4. Enumerations

### 4.1 `priceBy`

| Value | Sage label |
|---|---|
| `ItemNumber` | Item Number |
| `CategoryCode` | Category Code |

### 4.2 `contractPriceType`

| Value | Sage label | How the contract price is derived |
|---|---|---|
| `CustomerType` | Customer Type | From the customer's type (`customerType`, [4.3](#43-customertype)) |
| `DiscountPercentage` | Discount Percentage | Percent off the price-list price |
| `DiscountAmount` | Discount Amount | Amount off the price-list price |
| `CostPlusPercentage` | Cost Plus a Percentage | Percent added to cost |
| `CostPlusFixedAmount` | Cost Plus Fixed Amount | Amount added to cost |
| `FixedPrice` | Fixed Price | A fixed unit price |

Whatever the type, the **resolved unit price is returned as `calculatedUnitPrice`**. The API exposes the computed result, not the raw discount %/markup/fixed value typed into Sage (see [10](#10-open-items) if that raw input is ever needed).

### 4.3 `customerType`

`Base` \| `A` \| `B` \| `C` \| `D` \| `E` (confirmed from Sage). Present only when `contractPriceType = CustomerType`; `null` otherwise.

### 4.4 `itemPricingBy`

`Quantity` \| `Weight`.

---

## 5. `GET /contract-prices`

### 5.1 Default response (no parameters)

Returns **every row the credential is permitted to see** ([9](#9-access-control)) - no date filtering; past, current, and future-dated rows all included.

Default order: **`customerNumber asc, startDate desc`** (grouped by customer, most recent start date first within each). Default `$top = 50`.

> For a single global newest-first stream, pass `$orderby=startDate desc`.

### 5.2 Query parameters (OData style)

| Param | Type | Default | Description |
|---|---|---|---|
| `$filter` | string | - | Boolean filter expression ([5.3](#53-filter)) |
| `$orderby` | string | `customerNumber asc, startDate desc` | `field [asc\|desc]`, comma-separated |
| `$select` | string | all fields | Projection; comma-separated (always includes `id`) |
| `$top` | integer | `50` | Page size, **max `200`** |
| `$skip` | integer | `0` | Offset |
| `$count` | boolean | `false` | Include `@odata.count` (total matches, ignoring paging) |

Optional convenience aliases (sugar over `$filter`; AND-combined if mixed): `customerNumber=`, `q=` (matches `customerName`/`itemNumber`/`itemDescription`), `activeOn=YYYY-MM-DD` (rows whose window contains the date).

### 5.3 `$filter`

Operators: comparison `eq ne gt ge lt le`; logical `and or not` with `( )`; membership `field in ('A','B')`; null `field eq null` / `field ne null`; string functions `contains(field,'x')`, `startswith(field,'x')`, `endswith(field,'x')`.

Literals: strings single-quoted (`'CAN'`); numbers bare (`70.00`); dates ISO bare or quoted (`2026-06-23`); booleans `true`/`false`; enum tokens quoted (`'FixedPrice'`). String comparisons are **case-insensitive**.

Filterable fields: `customerNumber`, `customerName`, `priceBy`, `itemNumber`, `unformattedItemNumber`, `itemDescription`, `categoryCode`, `priceListCode`, `pricingUnit`, `itemPricingBy`, `contractPriceType`, `useLowestPrice`, `customerType`, `calculatedUnitPrice`, `startDate`, `expirationDate`.

```text
# One customer
$filter=customerNumber eq 'MOSEK31'

# Customer by name (partial, case-insensitive)
$filter=contains(customerName,'mosaic')

# Rows active on a date (open-ended start/expiry count as active)
$filter=(startDate eq null or startDate le 2026-06-23) and (expirationDate eq null or expirationDate ge 2026-06-23)

# One product's full schedule for a customer
$filter=customerNumber eq 'MOSEK31' and itemNumber eq '100-16'&$orderby=startDate asc

# Locks expiring within a window
$filter=expirationDate ge 2026-06-23 and expirationDate le 2026-07-23&$orderby=expirationDate asc

# Future-dated (scheduled) prices
$filter=customerNumber eq 'MOSEK31' and startDate gt 2026-06-23&$orderby=startDate asc

# Several price types
$filter=contractPriceType in ('FixedPrice','DiscountPercentage')
```

### 5.4 Sorting

`$orderby` accepts any filterable field. Default `customerNumber asc, startDate desc`. Examples: `expirationDate asc` (soonest-expiring), `startDate desc` (newest across all customers).

### 5.5 Pagination

Offset paging (`$top` + `$skip`). `@odata.count` included when `$count=true`; `@odata.nextLink` returned while more rows remain. Each response echoes the **applied** paging as `page: { top, skip }` - this is the authoritative page size when `$top` was clamped to the max ([8](#8-pagination--limits)).

### 5.6 Response - `200 OK`

Example shows a two-step schedule for one product (a current price window, then a future-dated one):

```jsonc
{
  "value": [
    {
      "id": "MOSEK31|ItemNumber|100-16|CAN|EA|2026-01-01",
      "customerNumber": "MOSEK31",
      "customerName": "Mosaic Business Services (K3)",
      "currencyCode": "CAD",
      "priceBy": "ItemNumber",
      "itemNumber": "100-16",
      "itemDescription": "TOOL BAG (8\"D x 16\"W x 14\"H)",
      "unformattedItemNumber": "10016",
      "categoryCode": null,
      "categoryDescription": null,
      "priceListCode": "CAN",
      "priceListName": "Canada",
      "pricingUnit": "EA",
      "itemPricingBy": "Quantity",
      "contractPriceType": "FixedPrice",
      "useLowestPrice": false,
      "customerType": null,
      "calculatedUnitPrice": 70.00,
      "startDate": "2026-01-01",
      "expirationDate": "2027-12-31"
    },
    {
      "id": "MOSEK31|ItemNumber|100-16|CAN|EA|2028-01-01",
      "customerNumber": "MOSEK31",
      "customerName": "Mosaic Business Services (K3)",
      "currencyCode": "CAD",
      "priceBy": "ItemNumber",
      "itemNumber": "100-16",
      "itemDescription": "TOOL BAG (8\"D x 16\"W x 14\"H)",
      "unformattedItemNumber": "10016",
      "categoryCode": null,
      "categoryDescription": null,
      "priceListCode": "CAN",
      "priceListName": "Canada",
      "pricingUnit": "EA",
      "itemPricingBy": "Quantity",
      "contractPriceType": "FixedPrice",
      "useLowestPrice": false,
      "customerType": null,
      "calculatedUnitPrice": 72.00,
      "startDate": "2028-01-01",
      "expirationDate": null
    }
  ],
  "@odata.count": 2,
  "@odata.nextLink": null,
  "page": { "top": 50, "skip": 0 }
}
```

---

## 6. `GET /contract-prices/{id}`

`200` with a single row (same shape as one `value[]` element), or `404`.

---

## 7. Errors

```jsonc
{ "error": { "code": "InvalidFilter", "message": "Unknown field 'foo' in $filter.", "target": "$filter" } }
```

| Status | `code` | When |
|---|---|---|
| `400` | `BadRequest` / `InvalidFilter` | Malformed `$filter`/`$orderby` or bad parameter |
| `401` | `Unauthorized` | Missing/invalid credentials |
| `403` | `Forbidden` | Credential not permitted to read the requested customer ([9](#9-access-control)) |
| `404` | `NotFound` | Unknown `id` |

---

## 8. Pagination & limits

- `$top` default `50`, max `200`. Requests above the max are clamped to `200`.
- `@odata.count` only computed when `$count=true`.
- Stable ordering across pages is guaranteed by `$orderby` (the default orders by the full key direction).

---

## 9. Access control

- **Read-only.** No mutation under any credential.
- A credential is either **customer-scoped** (bound to one `customerNumber`) or **back-office** (all customers).
- A customer-scoped credential MUST return only its own customer's rows. A `$filter`/alias targeting a different customer is rejected (`403`) or ignored in favour of the bound customer - implementer's choice, but it MUST NOT leak another customer's rows.
- Back-office credentials may query any customer.

---

## 11. Examples

Full request URLs (query strings shown unencoded for readability; URL-encode in practice).

```text
# Default - no parameters: every row the caller may see,
# customerNumber asc, startDate desc, first 50 rows
GET /api/v1/contract-prices

# One customer, all their contracts
GET /api/v1/contract-prices?$filter=customerNumber eq 'MOSEK31'

# One customer + one item (a single product's contract rows)
GET /api/v1/contract-prices?$filter=customerNumber eq 'MOSEK31' and itemNumber eq '100-16'

# One product's full price schedule for a customer, oldest → newest
GET /api/v1/contract-prices?$filter=customerNumber eq 'MOSEK31' and itemNumber eq '100-16'&$orderby=startDate asc

# Active-on-a-date prices for a customer, paged, with total count
GET /api/v1/contract-prices?activeOn=2026-06-23&$filter=customerNumber eq 'MOSEK31'&$orderby=itemNumber asc&$top=24&$count=true

# Future-dated (scheduled) prices for a customer
GET /api/v1/contract-prices?$filter=customerNumber eq 'MOSEK31' and startDate gt 2026-06-23&$orderby=startDate asc

# Renewal watch - locks expiring within a date window, soonest first (all customers)
GET /api/v1/contract-prices?$filter=expirationDate ge 2026-06-23 and expirationDate le 2026-07-23&$orderby=expirationDate asc

# Find by customer name (partial, case-insensitive)
GET /api/v1/contract-prices?$filter=contains(customerName,'mosaic')&$orderby=customerName asc,startDate desc

# Filter by price type(s)
GET /api/v1/contract-prices?$filter=contractPriceType in ('FixedPrice','DiscountPercentage')

# By price list, fixed-price contracts only
GET /api/v1/contract-prices?$filter=priceListCode eq 'CAN' and contractPriceType eq 'FixedPrice'

# Projection - return only the fields needed for a price list view
GET /api/v1/contract-prices?$filter=customerNumber eq 'MOSEK31'&$select=itemNumber,itemDescription,calculatedUnitPrice,startDate,expirationDate

# Second page (rows 51-100)
GET /api/v1/contract-prices?$filter=customerNumber eq 'MOSEK31'&$top=50&$skip=50

# Retrieve a single row by id
GET /api/v1/contract-prices/MOSEK31%7CItemNumber%7C100-16%7CCAN%7CEA%7C2026-01-01
```
