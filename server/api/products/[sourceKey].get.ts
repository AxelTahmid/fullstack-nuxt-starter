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

function firstItem(data: ICItemListResponseT | ICItemT | undefined): ICItemT | undefined {
	if (!data) {
		return undefined
	}

	if ("value" in data) {
		return data.value?.[0]
	}

	return data as ICItemT
}

function firstPricing(data: ICItemPricingListResponseT | ICItemPricingT | undefined): ICItemPricingT | undefined {
	if (!data) {
		return undefined
	}

	if ("value" in data) {
		return data.value?.[0]
	}

	return data as ICItemPricingT
}

async function loadPricing(item: ICItemT, sourceKey: string) {
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

		return {
			pricing: firstPricing(pricingResponse.data) ?? null,
			pricingUnavailableReason: null,
		}
	}
	catch {
		return {
			pricing: null,
			pricingUnavailableReason: "Unable to load Sage pricing for this item.",
		}
	}
}

export default defineEventHandler(async (event): Promise<{
	item: ICItemT
	pricing: ICItemPricingT | null
	pricingUnavailableReason: string | null
}> => {
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

	const pricingResult = await loadPricing(item, itemKey(item))

	return {
		item,
		pricing: pricingResult.pricing,
		pricingUnavailableReason: pricingResult.pricingUnavailableReason,
	}
})
