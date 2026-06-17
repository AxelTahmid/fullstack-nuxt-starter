import type { ICItemPricingT, ICItemT, OEOrderT } from "#shared/sage300"
import type { EstimateDetail, EstimateStatus, EstimateSummary } from "#shared/types/estimate"
import type { OrderDetail, OrderLine, OrderStatus, OrderSummary } from "#shared/types/order"

/**
 * Pure Sage 300 helpers shared across order/quote endpoints.
 *
 * This module never wraps generated SDK request methods (`oeOrdersGet`,
 * `oeOrdersPost`, ...). Endpoints call those directly. Here we only keep the
 * config-derived request path, OData string escaping, and response -> DTO
 * mappers, because those are duplicated verbatim across several handlers.
 */

export function sagePath() {
	const { sage300 } = useRuntimeConfig()

	return {
		apiVersion: String(sage300.apiVersion),
		tenant: String(sage300.tenant),
		company: String(sage300.company),
	}
}

export function escapeODataString(value: string) {
	return value.replace(/'/g, "''")
}

/**
 * Reads the OData v4 `@odata.count` from a `$count=true` list response.
 * Returns `null` when the install does not surface it, so callers can fall back
 * to cursor-style paging.
 */
export function odataCount(data: unknown): number | null {
	if (typeof data !== "object" || data === null) {
		return null
	}

	const raw = (data as Record<string, unknown>)["@odata.count"]
	if (typeof raw === "number") {
		return Number.isFinite(raw) ? raw : null
	}

	if (typeof raw === "string" && raw.trim() !== "") {
		const parsed = Number(raw)
		return Number.isNaN(parsed) ? null : parsed
	}

	return null
}

export function dollarsToCents(value: number | undefined) {
	return typeof value === "number" ? Math.round(value * 100) : 0
}

export interface ResolvedItemPricing {
	/** Regular price in cents (`null` when no price could be resolved). */
	baseCents: number | null
	/** Active sale price in cents, or `null` when the item is not on sale. */
	saleCents: number | null
	/** True when a valid, in-window sale price below the base price exists. */
	onSale: boolean
}

/**
 * Resolve an `ICItemPricing` record into base / sale prices.
 *
 * Base price prefers `BasePrice`, falling back to the default unit-of-measure
 * `UnitPrice` from `ItemPricingDetails` (some Sage configs leave `BasePrice` at
 * 0 and carry the real price per UOM). A sale price only counts when it is a
 * positive discount below the base and inside `SaleStartDate`/`SaleEndDate`.
 */
export function resolveItemPricing(pricing: ICItemPricingT | undefined): ResolvedItemPricing {
	if (!pricing) {
		return { baseCents: null, saleCents: null, onSale: false }
	}

	const detail = pricing.ItemPricingDetails?.find(row => row.DefaultUnit && typeof row.UnitPrice === "number")
		?? pricing.ItemPricingDetails?.find(row => typeof row.UnitPrice === "number")
	const baseRaw = typeof pricing.BasePrice === "number" && pricing.BasePrice > 0
		? pricing.BasePrice
		: detail?.UnitPrice
	const baseCents = typeof baseRaw === "number" && baseRaw > 0 ? Math.round(baseRaw * 100) : null

	const now = Date.now()
	const startedOk = !pricing.SaleStartDate || new Date(pricing.SaleStartDate).getTime() <= now
	const notEnded = !pricing.SaleEndDate || new Date(pricing.SaleEndDate).getTime() >= now
	const saleCentsRaw = typeof pricing.SalePrice === "number" && pricing.SalePrice > 0
		? Math.round(pricing.SalePrice * 100)
		: null
	const saleCents = saleCentsRaw !== null
		&& startedOk
		&& notEnded
		&& (baseCents === null || saleCentsRaw < baseCents)
		? saleCentsRaw
		: null

	return { baseCents, saleCents, onSale: saleCents !== null }
}

export function toIsoDate(value: Date | string | undefined) {
	if (!value) {
		return new Date().toISOString()
	}

	const date = value instanceof Date ? value : new Date(value)

	return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

export function toNullableIsoDate(value: Date | string | undefined): string | null {
	if (!value) {
		return null
	}

	const date = value instanceof Date ? value : new Date(value)

	return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function trimOptional(value: string | undefined) {
	const trimmed = value?.trim()

	return trimmed || undefined
}

/**
 * Parse a `YYYY-MM-DD` request field into a Date, or throw a 400.
 */
export function parseRequestDate(value: string | undefined, fieldName: string) {
	if (!value) {
		return undefined
	}

	const date = new Date(`${value}T00:00:00`)
	if (Number.isNaN(date.getTime())) {
		throw createError({
			statusCode: 400,
			statusMessage: `${fieldName} must be a valid date`,
		})
	}

	return date
}

/**
 * Short, human-traceable web reference stamped onto Sage `OrderReference`.
 */
export function webReference(prefix: string) {
	const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14)
	const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()

	return `${prefix}-${stamp}-${suffix}`
}

export function itemKey(item: ICItemT) {
	return item.UnformattedItemNumber || item.ItemNumber || ""
}

export function itemName(item: ICItemT) {
	return item.Description?.trim() || item.ItemNumber?.trim() || item.UnformattedItemNumber?.trim() || "Unnamed item"
}

export function orderLines(order: OEOrderT): OrderLine[] {
	return (order.OrderDetails ?? []).map((detail, index): OrderLine => {
		const unitPriceCents = dollarsToCents(detail.OrderUnitPrice ?? detail.PricingUnitPrice ?? detail.PricingBaseUnitPrice)
		// Completed/shipped orders zero out QuantityOrdered and ExtendedOrderAmount,
		// so fall back to the original/shipped quantity to keep the order's value.
		const quantity = detail.QuantityOrdered || detail.OriginalQuantityOrdered || detail.QuantityShippedtodate || 0
		const lineTotalCents = dollarsToCents(detail.ExtendedOrderAmount ?? detail.ExtendedAmount) || unitPriceCents * quantity

		return {
			id: detail.LineNumber ?? detail.DetailNumber ?? index + 1,
			sourceKey: detail.UnformattedItemNumber || detail.Item || "",
			sku: detail.Item || detail.UnformattedItemNumber || "",
			name: detail.Description?.trim() || detail.Item || detail.UnformattedItemNumber || "Order item",
			unitPriceCents,
			quantity,
			lineTotalCents,
		}
	})
}

function orderTotals(order: OEOrderT, lines: OrderLine[]) {
	const subtotalCents = dollarsToCents(order.OrderSubtotalAmount ?? order.OrderItemTotalAmount)
		|| lines.reduce((sum, line) => sum + line.lineTotalCents, 0)
	const taxCents = dollarsToCents(order.OrderExclTaxTotal ?? order.OrderInclTaxTotal)
	const totalCents = dollarsToCents(order.OrderTotal) || subtotalCents + taxCents

	return { subtotalCents, taxCents, totalCents }
}

function documentNumber(order: OEOrderT) {
	return order.OrderNumber?.trim() || order.OrderReference?.trim() || String(order.OrderUniquifier ?? "")
}

function lineCount(order: OEOrderT) {
	return order.NumberOfLinesOnOrder ?? order.OrderDetails?.length ?? 0
}

function customerLabel(order: OEOrderT) {
	return order.BillToName?.trim() || order.ShipToName?.trim() || order.CustomerNumber?.trim() || "—"
}

export function orderStatus(order: OEOrderT): OrderStatus {
	if (
		order.OrderCompleted === "CompleteIncluded"
		|| order.OrderCompleted === "CompleteNotIncluded"
		|| order.OrderCompleted === "CompleteDayEnd"
	) {
		return "delivered"
	}

	if (order.OrderPrintStatus === "Pickingslipprinted") {
		return "processing"
	}

	return "placed"
}

export function toOrderDetail(order: OEOrderT): OrderDetail {
	const lines = orderLines(order)
	const { subtotalCents, taxCents, totalCents } = orderTotals(order, lines)

	return {
		id: order.OrderUniquifier ?? 0,
		orderNumber: documentNumber(order),
		customerName: customerLabel(order),
		customerNumber: order.CustomerNumber?.trim() || "",
		status: orderStatus(order),
		subtotalCents,
		shippingCents: dollarsToCents(order.TotalAmountMiscellaneousCharges),
		taxCents,
		totalCents,
		paymentMethod: order.TermsCode?.trim() || "Account terms",
		poNumber: order.PurchaseOrderNumber?.trim() || null,
		deliverySite: order.ShipToName?.trim() || order.ShipToLocationCode?.trim() || "Delivery site unavailable",
		carrier: order.ShipViaCodeDescription?.trim() || order.ShipViaCode?.trim() || "To be confirmed",
		placedAt: toIsoDate(order.OrderDate),
		lines,
	}
}

export function toOrderSummary(order: OEOrderT): OrderSummary {
	const lines = orderLines(order)
	const { totalCents } = orderTotals(order, lines)

	return {
		id: order.OrderUniquifier ?? 0,
		orderNumber: documentNumber(order),
		poNumber: order.PurchaseOrderNumber?.trim() || null,
		customerName: customerLabel(order),
		customerNumber: order.CustomerNumber?.trim() || "",
		status: orderStatus(order),
		totalCents,
		placedAt: toIsoDate(order.OrderDate),
		itemCount: lineCount(order),
	}
}

export function estimateStatus(order: OEOrderT): EstimateStatus {
	if (order.OrderNumberActivatedFromQuot?.trim()) {
		return "converted"
	}

	if (order.QuoteExpired) {
		return "expired"
	}

	return "submitted"
}

export function toEstimateDetail(order: OEOrderT): EstimateDetail {
	const lines = orderLines(order)
	const { subtotalCents, taxCents, totalCents } = orderTotals(order, lines)

	return {
		id: order.OrderUniquifier ?? 0,
		quoteNumber: documentNumber(order),
		customerName: customerLabel(order),
		customerNumber: order.CustomerNumber?.trim() || "",
		status: estimateStatus(order),
		subtotalCents,
		taxCents,
		totalCents,
		deliverySite: order.ShipToName?.trim() || order.ShipToLocationCode?.trim() || "Delivery site unavailable",
		comment: order.OrderComment?.trim() || null,
		expiresAt: toNullableIsoDate(order.QuoteExpirationDate),
		createdAt: toIsoDate(order.OrderDate),
		convertedOrderNumber: order.OrderNumberActivatedFromQuot?.trim() || null,
		lines,
	}
}

export function toEstimateSummary(order: OEOrderT): EstimateSummary {
	const lines = orderLines(order)
	const { totalCents } = orderTotals(order, lines)

	return {
		id: order.OrderUniquifier ?? 0,
		quoteNumber: documentNumber(order),
		customerName: customerLabel(order),
		customerNumber: order.CustomerNumber?.trim() || "",
		status: estimateStatus(order),
		totalCents,
		itemCount: lineCount(order),
		expiresAt: toNullableIsoDate(order.QuoteExpirationDate),
		createdAt: toIsoDate(order.OrderDate),
	}
}
