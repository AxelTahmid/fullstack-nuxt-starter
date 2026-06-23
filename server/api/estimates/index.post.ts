import type { ICItemListResponseT, ICItemT, OEOrderT, OEOrderWritableT } from "#shared/sage300"
import { icItemsGet, oeOrdersPost } from "#shared/sage300"
import { createEstimateSchema } from "#shared/schemas/estimate"
import type { EstimateResponse } from "#shared/types/estimate"
import { authRepo, cartRepo } from "~~/server/db/repository"
import { auditNonCustomerAction } from "~~/server/utils/audit"
import { requireCustomer } from "~~/server/utils/auth"
import {
	escapeODataString,
	itemKey,
	itemName,
	parseRequestDate,
	sagePath,
	trimOptional,
	webReference,
} from "~~/server/utils/sage300"

const QUOTE_VALIDITY_DAYS = 30

async function loadItems(sourceKeys: string[]) {
	const response = await icItemsGet({
		path: sagePath(),
		query: {
			$filter: sourceKeys
				.map(sourceKey => `UnformattedItemNumber eq '${escapeODataString(sourceKey)}'`)
				.join(" or "),
			$top: sourceKeys.length,
		},
	})
	const data = response.data as ICItemListResponseT

	return new Map((data.value ?? [])
		.map(item => [itemKey(item), item])
		.filter((entry): entry is [string, ICItemT] => Boolean(entry[0])))
}

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

function quoteExpiry() {
	const expiry = new Date()
	expiry.setDate(expiry.getDate() + QUOTE_VALIDITY_DAYS)

	return expiry
}

export default defineEventHandler(async (event): Promise<EstimateResponse> => {
	const sessionUser = await requireCustomer(event)
	const user = await authRepo.findUserById(sessionUser.id)
	const body = await readValidatedBody(event, createEstimateSchema.parse)

	// A Sage OE quote is keyed to a customer account; without it there is no
	// Sage document to create. Unlinked RFQs are an enquiry/email concern.
	if (!user?.sage_customer_number) {
		throw createError({
			statusCode: 400,
			statusMessage: "Customer account is not linked",
		})
	}

	// Explicit items win; otherwise fall back to the working cart.
	const requestedItems = body.items?.length
		? body.items
		: (await cartRepo.listItems(sessionUser.id)).map(item => ({
				sourceKey: item.source_key,
				quantity: item.quantity,
			}))

	if (requestedItems.length === 0) {
		throw createError({
			statusCode: 400,
			statusMessage: "Select at least one item to request an estimate",
		})
	}

	const sourceKeys = requestedItems.map(item => item.sourceKey)
	const itemsByKey = await loadItems(sourceKeys)
	const missingKey = sourceKeys.find(sourceKey => !itemsByKey.has(sourceKey))
	if (missingKey) {
		throw createError({
			statusCode: 409,
			statusMessage: `Estimate contains unavailable item: ${missingKey}`,
		})
	}

	const reference = webReference("WEB-Q")
	const requestedShipDate = parseRequestDate(body.requestedShipDate, "Requested ship date")
	const comment = [
		trimOptional(body.projectReference) ? `Project: ${trimOptional(body.projectReference)}` : null,
		`Delivery site: ${body.deliverySite}`,
		trimOptional(body.deliveryContact) ? `Delivery contact: ${trimOptional(body.deliveryContact)}` : null,
		requestedShipDate ? `Needed by: ${body.requestedShipDate}` : null,
		trimOptional(body.budgetRange) ? `Budget range: ${trimOptional(body.budgetRange)}` : null,
		trimOptional(body.notes) ? `Notes: ${trimOptional(body.notes)}` : null,
	]
		.filter((value): value is string => Boolean(value))
		.join("\n")

	const { sage300 } = useRuntimeConfig()
	const priceListCode = String(sage300.priceListCode || "")
	const payload: OEOrderWritableT = {
		CustomerNumber: user.sage_customer_number,
		OrderType: "Quote",
		// Sage's API validates these as ISO datetime strings, not Date objects.
		OrderDate: new Date().toISOString(),
		ExpectedShipDate: requestedShipDate?.toISOString(),
		QuoteExpirationDate: quoteExpiry().toISOString(),
		DefaultPriceListCode: priceListCode || undefined,
		OrderReference: reference,
		OrderDescription: `SupplyKey estimate ${reference}`,
		OrderComment: comment,
		ShipToName: body.deliverySite,
		ShipToContact: trimOptional(body.deliveryContact),
		RecalculateTax: true,
		OrderDetails: requestedItems.map((requested) => {
			const item = itemsByKey.get(requested.sourceKey)

			return {
				LineType: "Item",
				Item: item?.ItemNumber || requested.sourceKey,
				UnformattedItemNumber: item?.UnformattedItemNumber || requested.sourceKey,
				Description: item ? itemName(item) : requested.sourceKey,
				QuantityOrdered: requested.quantity,
				PriceList: priceListCode || item?.DefaultPriceListCode?.trim() || undefined,
			}
		}),
		OrderCommentsInstructions: comment
			? [{
					CommentsInstructionsType: "Comment",
					CommentsInstructions: comment,
				}]
			: undefined,
	}

	const response = await oeOrdersPost({
		path: sagePath(),
		body: payload,
	})
	const order = postedOrder(response.data)
	const quoteNumber = order?.OrderNumber?.trim() || reference

	await auditNonCustomerAction(event, sessionUser, {
		action: "estimate.request",
		targetType: "estimate",
		targetId: quoteNumber,
		summary: `${sessionUser.email} requested estimate ${quoteNumber}`,
		metadata: {
			customerNumber: user.sage_customer_number,
			lineCount: requestedItems.length,
		},
	})

	return {
		quoteNumber,
	}
})
