import type { OEOrderListResponseT, OEOrderT, OEOrderWritableT } from "#shared/sage300"
import { oeOrdersGet, oeOrdersPost } from "#shared/sage300"
import type { CheckoutResponse } from "#shared/types/order"
import { authRepo } from "~~/server/db/repository"
import { auditNonCustomerAction } from "~~/server/utils/audit"
import { requireSessionUser } from "~~/server/utils/auth"
import { escapeODataString, sagePath } from "~~/server/utils/sage300"

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null
}

function postedOrder(value: unknown): OEOrderT | null {
	if (!isRecord(value)) {
		return null
	}

	if (Array.isArray(value.value) && isRecord(value.value[0])) {
		return value.value[0] as OEOrderT
	}

	return value as OEOrderT
}

export default defineEventHandler(async (event): Promise<CheckoutResponse> => {
	const sessionUser = await requireSessionUser(event)
	const number = getRouterParam(event, "number")?.trim()

	if (!number) {
		throw createError({
			statusCode: 400,
			statusMessage: "Estimate number is required",
		})
	}

	const user = await authRepo.findUserById(sessionUser.id)
	const customerFilter = sessionUser.role === "admin"
		? ""
		: user?.sage_customer_number
			? ` and CustomerNumber eq '${escapeODataString(user.sage_customer_number)}'`
			: null

	if (customerFilter === null) {
		throw createError({
			statusCode: 400,
			statusMessage: "Customer account is not linked",
		})
	}

	// Resolve the source quote and enforce access before converting.
	const quoteFilter = `(OrderNumber eq '${escapeODataString(number)}' or OrderReference eq '${escapeODataString(number)}') and OrderType eq 'Quote'`
	const lookup = await oeOrdersGet({
		path: sagePath(),
		query: {
			$filter: `${quoteFilter}${customerFilter}`,
			$top: 1,
		},
	})
	const quote = (lookup.data as OEOrderListResponseT).value?.[0]

	if (!quote) {
		throw createError({
			statusCode: 404,
			statusMessage: "Estimate not found",
		})
	}

	if (quote.OrderNumberActivatedFromQuot?.trim()) {
		throw createError({
			statusCode: 409,
			statusMessage: `Estimate already converted to order ${quote.OrderNumberActivatedFromQuot.trim()}`,
		})
	}

	if (quote.QuoteExpired) {
		throw createError({
			statusCode: 409,
			statusMessage: "Estimate has expired and cannot be converted",
		})
	}

	// Sage converts a quote to an order via the OEOrders process command rather
	// than a dedicated endpoint: post an Active order that pulls the quote lines.
	const payload: OEOrderWritableT = {
		CustomerNumber: quote.CustomerNumber || user?.sage_customer_number || undefined,
		OrderType: "Active",
		// Sage's API validates OrderDate as an ISO datetime string, not a Date object.
		OrderDate: new Date().toISOString(),
		ProcessOECommand: "CreateOrderFromQuotes",
		PerformMultipleQuotesToOrder: true,
		RecalculateTax: true,
		OrderFromQuotes: [{
			QuoteNumber: quote.OrderNumber?.trim() || number,
			QuoteUniquifier: quote.OrderUniquifier,
		}],
	}

	const response = await oeOrdersPost({
		path: sagePath(),
		body: payload,
	})
	const order = postedOrder(response.data)
	const orderNumber = order?.OrderNumber?.trim()

	if (!orderNumber) {
		throw createError({
			statusCode: 502,
			statusMessage: "Sage did not return an order number for the conversion",
		})
	}

	await auditNonCustomerAction(event, sessionUser, {
		action: "estimate.convert",
		targetType: "order",
		targetId: orderNumber,
		summary: `${sessionUser.email} converted estimate ${number} to order ${orderNumber}`,
		metadata: {
			estimateNumber: quote.OrderNumber?.trim() || number,
			customerNumber: quote.CustomerNumber || user?.sage_customer_number || null,
		},
	})

	return {
		orderNumber,
	}
})
