import type { CartLine, CartSummary } from "#shared/types/cart"
import type { ICItemListResponseT, ICItemPricingListResponseT, ICItemPricingT, ICItemT } from "#shared/sage300"
import { icItemPricingGet, icItemsGet } from "#shared/sage300"
import { cartRepo } from "~~/server/db/repository"
import { requireSessionUser } from "~~/server/utils/auth"

function sagePath() {
	const { sage300 } = useRuntimeConfig()

	return {
		apiVersion: String(sage300.apiVersion),
		tenant: String(sage300.tenant),
		company: String(sage300.company),
	}
}

function escapeODataString(value: string) {
	return value.replace(/'/g, "''")
}

function itemKey(item: ICItemT) {
	return item.UnformattedItemNumber || item.ItemNumber || ""
}

function itemName(item: ICItemT) {
	return item.Description?.trim() || item.ItemNumber?.trim() || item.UnformattedItemNumber?.trim() || "Unnamed item"
}

function defaultPricingDetail(pricing: ICItemPricingT | undefined) {
	return pricing?.ItemPricingDetails?.find(detail => detail.DefaultUnit && typeof detail.UnitPrice === "number")
		?? pricing?.ItemPricingDetails?.find(detail => typeof detail.UnitPrice === "number")
}

function unitPriceCents(pricing: ICItemPricingT | undefined) {
	const unitPrice = pricing?.SalePrice ?? defaultPricingDetail(pricing)?.UnitPrice ?? pricing?.BasePrice

	return typeof unitPrice === "number" ? Math.round(unitPrice * 100) : 0
}

async function loadItems(sourceKeys: string[]) {
	if (sourceKeys.length === 0) {
		return new Map<string, ICItemT>()
	}

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

async function loadPricing(items: ICItemT[]) {
	const keyedItems = items.filter(item => itemKey(item))
	if (keyedItems.length === 0) {
		return new Map<string, ICItemPricingT>()
	}

	const { sage300 } = useRuntimeConfig()
	const currencyCode = String(sage300.currencyCode || "CAD")
	const configuredPriceListCode = String(sage300.priceListCode || "")
	const itemFilters = keyedItems.map((item) => {
		const sourceKey = itemKey(item)
		const priceListCode = configuredPriceListCode || item.DefaultPriceListCode?.trim()
		const sourceFilter = `UnformattedItemNumber eq '${escapeODataString(sourceKey)}'`

		return priceListCode
			? `(${sourceFilter} and PriceListCode eq '${escapeODataString(priceListCode)}')`
			: sourceFilter
	})

	try {
		const response = await icItemPricingGet({
			path: sagePath(),
			query: {
				$filter: `CurrencyCode eq '${escapeODataString(currencyCode)}' and (${itemFilters.join(" or ")})`,
				$top: keyedItems.length,
			},
		})
		const data = response.data as ICItemPricingListResponseT

		return new Map((data.value ?? [])
			.map(price => [price.UnformattedItemNumber || price.ItemNumber || "", price])
			.filter((entry): entry is [string, ICItemPricingT] => Boolean(entry[0])))
	}
	catch {
		return new Map<string, ICItemPricingT>()
	}
}

function buildSummary(lines: CartLine[]): CartSummary {
	const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0)
	const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0)
	const shippingCents = 0
	const taxCents = 0
	const totalCents = subtotalCents + shippingCents + taxCents

	return {
		lines,
		itemCount,
		subtotalCents,
		shippingCents,
		taxCents,
		totalCents,
	}
}

export default defineEventHandler(async (event): Promise<CartSummary> => {
	const user = await requireSessionUser(event)
	const cartItems = await cartRepo.listItems(user.id)
	const sourceKeys = cartItems.map(item => item.source_key)
	const itemsByKey = await loadItems(sourceKeys)
	const pricingByKey = await loadPricing([...itemsByKey.values()])
	const lines = cartItems.map((cartItem): CartLine => {
		const item = itemsByKey.get(cartItem.source_key)
		const pricing = item ? pricingByKey.get(itemKey(item)) : undefined
		const unitPriceCentsValue = unitPriceCents(pricing)

		return {
			id: cartItem.id,
			sourceKey: cartItem.source_key,
			sku: item?.ItemNumber || cartItem.source_key,
			name: item ? itemName(item) : "Unavailable item",
			category: item?.Category?.trim() || "Uncategorized",
			manufacturer: item?.PreferredVendor?.trim() || "Manufacturer unavailable",
			imageUrl: null,
			unitPriceCents: unitPriceCentsValue,
			quantity: cartItem.quantity,
			lineTotalCents: unitPriceCentsValue * cartItem.quantity,
		}
	})

	return buildSummary(lines)
})
