import type {
	ICItemListResponseT,
	ICItemPricingListResponseT,
	ICItemPricingT,
	ICItemT,
} from "#shared/sage300"
import {
	icItemPricingGet,
	icItemPricingGetByCurrencyCodeAndUnformattedItemNumberAndPriceListCode,
	icItemsGetByUnformattedItemNumber,
} from "#shared/sage300"
import type {
	ProductDetailResponse,
	ProductListItem,
	ProductPricingDetail,
} from "#shared/types/product"
import { requireSessionUser } from "~~/server/utils/auth"

const DEFAULT_MANUFACTURER = "Sage 300"

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
	return item.Description?.trim() || item.ItemNumber?.trim() || item.UnformattedItemNumber?.trim() || "Unnamed Sage item"
}

function itemComments(item: ICItemT) {
	return [item.Comment1, item.Comment2, item.Comment3, item.Comment4]
		.map(comment => comment?.trim())
		.filter((comment): comment is string => Boolean(comment))
}

function itemDescription(item: ICItemT) {
	return itemComments(item).join(" ") || item.Description?.trim() || "Sage 300 inventory item"
}

function stockStatus(item: ICItemT): ProductListItem["stockStatus"] {
	if (item.Sellable === false || item.Status === false) {
		return "out_of_stock"
	}

	const available = item.QuantityAvailable ?? item.QuantityOnHand
	if (typeof available !== "number") {
		return "in_stock"
	}

	if (available <= 0) {
		return "out_of_stock"
	}

	return available <= 5 ? "low_stock" : "in_stock"
}

function firstItem(data: ICItemListResponseT | ICItemT | undefined) {
	if (!data) {
		return undefined
	}

	if ("value" in data) {
		return data.value?.[0]
	}

	return data
}

function firstPricing(data: ICItemPricingListResponseT | ICItemPricingT | undefined) {
	if (!data) {
		return undefined
	}

	if ("value" in data) {
		return data.value?.[0]
	}

	return data
}

function cents(value: number | undefined) {
	return typeof value === "number" ? Math.round(value * 100) : null
}

function dateString(value: Date | undefined) {
	return value ? value.toISOString() : null
}

function toProductListItem(item: ICItemT, priceCents: number | null): ProductListItem {
	const sourceKey = itemKey(item)

	return {
		id: null,
		sourceKey,
		sku: item.ItemNumber || sourceKey,
		name: itemName(item),
		description: itemDescription(item),
		category: item.Category?.trim() || "Uncategorized",
		manufacturer: item.PreferredVendor?.trim() || DEFAULT_MANUFACTURER,
		imageUrl: null,
		priceCents,
		stockStatus: stockStatus(item),
		tags: [
			item.StockingUnitOfMeasure,
			item.DefaultPriceListCode,
			item.StockItem ? "stock-item" : undefined,
		].filter((tag): tag is string => Boolean(tag)),
	}
}

function emptyPricing(currencyCode: string, priceListCode: string | null, unavailableReason: string): ProductPricingDetail {
	return {
		currencyCode,
		priceListCode,
		unitPriceCents: null,
		basePriceCents: null,
		salePriceCents: null,
		unitOfMeasure: null,
		saleStartsOn: null,
		saleEndsOn: null,
		unavailableReason,
	}
}

async function loadPricing(item: ICItemT, sourceKey: string): Promise<ProductPricingDetail> {
	const { sage300 } = useRuntimeConfig()
	const currencyCode = String(sage300.currencyCode || "CAD")
	const configuredPriceListCode = String(sage300.priceListCode || "")
	const priceListCode = configuredPriceListCode || item.DefaultPriceListCode?.trim() || ""

	try {
		const pricingResponse = priceListCode
			? await icItemPricingGetByCurrencyCodeAndUnformattedItemNumberAndPriceListCode({
					path: {
						...sagePath(),
						CurrencyCode: currencyCode,
						UnformattedItemNumber: sourceKey,
						PriceListCode: priceListCode,
					},
				})
			: await icItemPricingGet({
					path: sagePath(),
					query: {
						$filter: `CurrencyCode eq '${escapeODataString(currencyCode)}' and UnformattedItemNumber eq '${escapeODataString(sourceKey)}'`,
						$top: 1,
					},
				})

		const pricing = firstPricing(pricingResponse.data)
		if (!pricing) {
			return emptyPricing(currencyCode, priceListCode || null, "Sage did not return pricing for this item.")
		}

		const defaultDetail = pricing.ItemPricingDetails?.find(detail => detail.DefaultUnit && typeof detail.UnitPrice === "number")
			?? pricing.ItemPricingDetails?.find(detail => typeof detail.UnitPrice === "number")
		const unitPrice = pricing.SalePrice ?? defaultDetail?.UnitPrice ?? pricing.BasePrice

		return {
			currencyCode: pricing.CurrencyCode || currencyCode,
			priceListCode: pricing.PriceListCode || priceListCode || null,
			unitPriceCents: cents(unitPrice),
			basePriceCents: cents(pricing.BasePrice),
			salePriceCents: cents(pricing.SalePrice),
			unitOfMeasure: pricing.SaleUnitOfMeasure || pricing.PricingUnitOfMeasure || defaultDetail?.QuantityUnit || item.StockingUnitOfMeasure || null,
			saleStartsOn: dateString(pricing.SaleStartDate),
			saleEndsOn: dateString(pricing.SaleEndDate),
			unavailableReason: typeof unitPrice === "number" ? null : "Sage pricing exists, but no unit price was returned.",
		}
	}
	catch {
		return emptyPricing(currencyCode, priceListCode || null, "Unable to load Sage pricing for this item.")
	}
}

export default defineEventHandler(async (event): Promise<ProductDetailResponse> => {
	await requireSessionUser(event)

	const sourceKey = getRouterParam(event, "sourceKey")
	if (!sourceKey) {
		throw createError({
			statusCode: 400,
			statusMessage: "Product source key is required",
		})
	}

	const itemResponse = await icItemsGetByUnformattedItemNumber({
		path: {
			...sagePath(),
			UnformattedItemNumber: sourceKey,
		},
	})
	const item = firstItem(itemResponse.data)
	if (!item || !itemKey(item)) {
		throw createError({
			statusCode: 404,
			statusMessage: "Product not found",
		})
	}

	const pricing = await loadPricing(item, itemKey(item))

	return {
		product: toProductListItem(item, pricing.unitPriceCents),
		pricing,
		inventory: {
			quantityOnHand: item.QuantityOnHand ?? null,
			quantityAvailable: item.QuantityAvailable ?? null,
			quantityCommitted: item.QuantityCommitted ?? null,
			quantityOnPurchaseOrder: item.QuantityOnPurchaseOrder ?? null,
			quantityOnSalesOrder: item.QuantityOnSalesOrder ?? null,
			stockingUnitOfMeasure: item.StockingUnitOfMeasure ?? null,
			weightUnitOfMeasure: item.WeightUnitOfMeasure ?? null,
			unitWeight: item.UnitWeight ?? null,
		},
		sage: {
			itemNumber: item.ItemNumber || itemKey(item),
			unformattedItemNumber: itemKey(item),
			accountSetCode: item.AccountSetCode ?? null,
			defaultPriceListCode: item.DefaultPriceListCode ?? null,
			preferredVendorItem: item.PreferredVendorItem ?? null,
			tariffCode: item.TariffCode ?? null,
			stockItem: item.StockItem ?? null,
			sellable: item.Sellable ?? null,
			active: item.Status ?? null,
			dateLastMaintained: dateString(item.DateLastMaintained),
			dateInactive: dateString(item.DateInactive),
		},
		comments: itemComments(item),
	}
})
