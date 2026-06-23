import type { ICItemListResponseT, ICItemT, OEOrderT, OEOrderWritableT } from "#shared/sage300"
import { icItemsGet, oeOrdersPost } from "#shared/sage300"
import { checkoutSchema } from "#shared/schemas/checkout"
import type { CheckoutResponse } from "#shared/types/order"
import { authRepo, cartRepo } from "~~/server/db/repository"
import { auditNonCustomerAction } from "~~/server/utils/audit"
import { requireSessionUser } from "~~/server/utils/auth"
import {
	escapeODataString,
	itemKey,
	itemName,
	parseRequestDate,
	sagePath,
	trimOptional,
	webReference,
} from "~~/server/utils/sage300"

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

export default defineEventHandler(async (event): Promise<CheckoutResponse> => {
	const sessionUser = await requireSessionUser(event)
	const user = await authRepo.findUserById(sessionUser.id)
	const body = await readValidatedBody(event, checkoutSchema.parse)

	if (!user?.sage_customer_number) {
		throw createError({
			statusCode: 400,
			statusMessage: "Customer account is not linked",
		})
	}

	const cartItems = await cartRepo.listItems(sessionUser.id)
	if (cartItems.length === 0) {
		throw createError({
			statusCode: 400,
			statusMessage: "Cart is empty",
		})
	}

	const sourceKeys = cartItems.map(item => item.source_key)
	const itemsByKey = await loadItems(sourceKeys)
	const missingKey = sourceKeys.find(sourceKey => !itemsByKey.has(sourceKey))
	if (missingKey) {
		throw createError({
			statusCode: 409,
			statusMessage: `Cart contains unavailable item: ${missingKey}`,
		})
	}

	const orderReference = webReference("WEB")
	const requestedShipDate = parseRequestDate(body.requestedShipDate, "Requested ship date")
	const shippingComment = [
		`Delivery site: ${body.deliverySite}`,
		trimOptional(body.deliveryContact) ? `Delivery contact: ${trimOptional(body.deliveryContact)}` : null,
		requestedShipDate ? `Requested ship date: ${body.requestedShipDate}` : null,
		`Carrier preference: ${body.carrier}`,
		trimOptional(body.shippingInstructions) ? `Shipping instructions: ${trimOptional(body.shippingInstructions)}` : null,
	]
		.filter((value): value is string => Boolean(value))
		.join("\n")

	const { sage300 } = useRuntimeConfig()
	const priceListCode = String(sage300.priceListCode || "")
	const payload: OEOrderWritableT = {
		CustomerNumber: user.sage_customer_number,
		OrderType: "Active",
		// Sage's API validates these as ISO datetime strings, not Date objects.
		OrderDate: new Date().toISOString(),
		ExpectedShipDate: requestedShipDate?.toISOString(),
		DefaultPriceListCode: priceListCode || undefined,
		PurchaseOrderNumber: trimOptional(body.poNumber),
		OrderReference: orderReference,
		OrderDescription: `SupplyKey order ${orderReference}`,
		OrderComment: shippingComment,
		ShipToName: body.deliverySite,
		ShipToContact: trimOptional(body.deliveryContact),
		RecalculateTax: true,
		OrderDetails: cartItems.map((cartItem) => {
			const item = itemsByKey.get(cartItem.source_key)

			return {
				LineType: "Item",
				Item: item?.ItemNumber || cartItem.source_key,
				UnformattedItemNumber: item?.UnformattedItemNumber || cartItem.source_key,
				Description: item ? itemName(item) : cartItem.source_key,
				QuantityOrdered: cartItem.quantity,
				PriceList: priceListCode || item?.DefaultPriceListCode?.trim() || undefined,
			}
		}),
		OrderCommentsInstructions: shippingComment
			? [{
					CommentsInstructionsType: "Instruction",
					CommentsInstructions: shippingComment,
				}]
			: undefined,
	}

	const response = await oeOrdersPost({
		path: sagePath(),
		body: payload,
	})
	const order = postedOrder(response.data)
	const orderNumber = order?.OrderNumber?.trim() || orderReference

	await cartRepo.clearItems(sessionUser.id)
	await auditNonCustomerAction(event, sessionUser, {
		action: "order.submit",
		targetType: "order",
		targetId: orderNumber,
		summary: `${sessionUser.email} submitted order ${orderNumber}`,
		metadata: {
			customerNumber: user.sage_customer_number,
			lineCount: cartItems.length,
		},
	})

	return {
		orderNumber,
	}
})
