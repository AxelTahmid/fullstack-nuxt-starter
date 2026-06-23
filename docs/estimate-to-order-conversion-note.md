# Note: Estimate → Order conversion (for the accountant / Sage admin)

**Date:** 2026-06-23
**Audience:** Accountant / Sage 300 administrator (and us)
**Short version:** The customer portal can create quotes and place orders in Sage just fine. The one thing not working is **"convert a quote/estimate into an order."** Sage *accepts* the request and reports success, but the order it creates comes out **empty** (no line items, $0). We've proven the portal is asking Sage correctly — so this needs to be sorted **on the Sage side**.

---

## What works today

The portal talks to Sage through the **Sage 300 Web API**. Verified working against the live company (`CMSTST`):

| Action | Status | Proof (look these up in Sage) |
|---|---|---|
| Place an order from the cart | ✅ Works | Order **ORD011891** — 1 line, **$1,720.50** |
| Create an estimate (a Sage O/E **Quote**) | ✅ Works | Quote **QT005596** — 1 line, **$1,720.50** |
| **Convert that quote into an order** | ❌ **Creates an empty order** | Order **ORD011892** — **0 lines, $0** |

## What's wrong, in plain terms

In Sage, a quote and an order are the same kind of document (an O/E order) — a quote just has a "Quote" type. "Converting" is Sage's built-in **"Create Order From Quote"** function. The portal calls exactly that function.

When we call it through the Web API:

- Sage replies **"Created (201 OK)"** — i.e. success.
- But the new order has **no lines and a $0 total** — Sage did **not** copy the quote's items across.

Every empty test order from this is real and in Sage now: **ORD011893, ORD011895, ORD011896, ORD011897, ORD011900** (all 0 lines), plus the quotes **QT005596–QT005603**. (Please don't delete these yet — they're our evidence.)

## What we ruled out (so this isn't a portal bug)

We tested exhaustively against the live Sage Web API:

- We're calling the **correct, official Sage function** (`CreateOrderFromQuotes` is a valid Sage command).
- We send the correct data (the quote number + Sage's internal quote ID), and we tried **every accepted variation** of the request. All returned "success" but empty.
- There is **no separate/dedicated conversion endpoint** in Sage's Web API — the function we're using is the only one.
- Sage's own API **documentation (swagger) is incomplete/misleading** here (it advertises fields the live system then rejects), so it can't tell us a "magic" field — and we confirmed by testing.

**Conclusion:** the Web API is accepting the command but **not executing the copy-the-lines step.** That points to Sage configuration, permissions, or version — not the portal code.

## What we need checked on the Sage side (most likely first)

1. **Web API user permissions.** The portal connects as the Sage user **`DEV`**. Please confirm this user has the **Order Entry security right to "Create Order From Quote."** Sage commonly *silently* ignores a process command the user isn't authorized for (which matches exactly what we see — "success," but nothing happens).
2. **Desktop sanity check.** Open one of our test quotes (e.g. **QT005603**) in the **Sage desktop** and run **Create Order From Quote**.
   - If the **desktop works** → it's a Web API permission/version gap (item 1 or 3).
   - If the **desktop also fails** → it's a data/setup issue with the quotes themselves.
3. **Sage version / Web API patch level.** Confirm this Sage 300 build's Web API actually implements "Create Order From Quote." Some versions stub it out.

Once any of these is corrected, **no code change is needed on our side** — the portal is already sending the correct request and it will start working.

## Why this matters for pricing (important for the accountant)

There's a tempting shortcut: instead of Sage's native conversion, the portal could just *re-create* the order by copying the quote's items. **We strongly recommend against it**, and here's why, proven by test:

- When the portal hands Sage an order with a **manually set price** (we tried $500 on an item that lists at $775), **Sage overrides it and re-prices at the current list/contract price.** (Test orders **ORD011898, ORD011899** both came back at $775, ignoring our $500.)
- So a "rebuild the order" workaround would **re-price every line at today's price** and **lose any negotiated/contract price** that was agreed on the quote.
- **Only Sage's native "Create Order From Quote" preserves the quote's agreed prices.** That's the whole point of a quote — to lock a price — and only Sage honors that lock.

**Bottom line for the discussion:** getting the native conversion working in Sage (the permission/version check above) is the correct fix, *and* it's the only way the order will honor the price agreed on the estimate.
