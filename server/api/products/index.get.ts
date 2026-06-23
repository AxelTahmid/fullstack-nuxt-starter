import type {
	ICItemListResponseT,
	ICItemT,
} from "#shared/sage300"
import {
	icItemsGet,
} from "#shared/sage300"
import type { ProductListItem, ProductListResponse } from "#shared/types/product"
import { productImageRepo } from "~~/server/db/repository"
import { requireSessionUser } from "~~/server/utils/auth"
import { productImagePublicUrl } from "~~/server/utils/objectStorage"

const DEFAULT_PAGE_SIZE = 24
const DEFAULT_MANUFACTURER = "Manufacturer unavailable"

// Web-store catalog gate: a product is visible (to customers AND admins) only when
// all three Sage I/C Item flags are set — "Allow Item in Web Store", "Sellable",
// and "Stock Item". Stock level is surfaced as a badge, not used to hide products.
const WEB_STORE_FILTER = "AllowItemInWebStore eq true and Sellable eq true and StockItem eq true"

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

function buildItemFilter(category: string | undefined, manufacturer: string | undefined, q: string | undefined) {
	const filters: string[] = []

	if (category) {
		filters.push(`Category eq '${escapeODataString(category)}'`)
	}

	if (manufacturer && manufacturer !== DEFAULT_MANUFACTURER) {
		filters.push(`PreferredVendor eq '${escapeODataString(manufacturer)}'`)
	}

	if (q?.trim()) {
		const search = escapeODataString(q.trim())
		filters.push([
			`contains(Description,'${search}')`,
			`contains(ItemNumber,'${search}')`,
			`contains(UnformattedItemNumber,'${search}')`,
			`contains(Category,'${search}')`,
		].join(" or "))
	}

	return filters.length > 0 ? filters.join(" and ") : undefined
}

function itemKey(item: ICItemT) {
	return item.UnformattedItemNumber || item.ItemNumber || ""
}

function itemName(item: ICItemT) {
	return item.Description?.trim() || item.ItemNumber?.trim() || item.UnformattedItemNumber?.trim() || "Unnamed item"
}

function itemDescription(item: ICItemT) {
	const comments = [item.Comment1, item.Comment2, item.Comment3, item.Comment4]
		.map(comment => comment?.trim())
		.filter((comment): comment is string => Boolean(comment))

	return comments.join(" ") || item.Description?.trim() || "Catalog item"
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

function toProductListItem(item: ICItemT): ProductListItem | undefined {
	const sourceKey = itemKey(item)

	if (!sourceKey) {
		return
	}

	return {
		id: null,
		sourceKey,
		sku: item.ItemNumber || sourceKey,
		name: itemName(item),
		description: itemDescription(item),
		category: item.Category?.trim() || "Uncategorized",
		manufacturer: item.PreferredVendor?.trim() || DEFAULT_MANUFACTURER,
		imageUrl: null,
		// Pricing is intentionally omitted here to keep the shop list to a single
		// Sage call; per-item pricing is loaded on the product detail page.
		priceCents: null,
		stockStatus: stockStatus(item),
		tags: [
			item.StockingUnitOfMeasure,
			item.DefaultPriceListCode,
			item.StockItem ? "stock-item" : undefined,
		].filter((tag): tag is string => Boolean(tag)),
	}
}

function countFacets(items: ProductListItem[]) {
	const categories = new Map<string, number>()
	const manufacturers = new Map<string, number>()

	items.forEach((item) => {
		categories.set(item.category, (categories.get(item.category) ?? 0) + 1)
		manufacturers.set(item.manufacturer, (manufacturers.get(item.manufacturer) ?? 0) + 1)
	})

	return {
		categories: [...categories.entries()]
			.map(([value, count]) => ({ value, count }))
			.sort((a, b) => a.value.localeCompare(b.value)),
		manufacturers: [...manufacturers.entries()]
			.map(([value, count]) => ({ value, count }))
			.sort((a, b) => a.value.localeCompare(b.value)),
	}
}

export default defineEventHandler(async (event): Promise<ProductListResponse> => {
	await requireSessionUser(event)

	const query = getQuery(event)
	const category = typeof query.category === "string" && query.category.length > 0 ? query.category : undefined
	const manufacturer = typeof query.manufacturer === "string" && query.manufacturer.length > 0 ? query.manufacturer : undefined
	const q = typeof query.q === "string" && query.q.length > 0 ? query.q : undefined
	const pageRaw = typeof query.page === "string" ? Number.parseInt(query.page, 10) : 1
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
	const filter = buildItemFilter(category, manufacturer, q)

	// The web-store catalog (customers and admins alike): items flagged for the web
	// store, sellable, and stocked. Stock level is shown as a badge, not a filter.
	const $filter = [filter, WEB_STORE_FILTER].filter(Boolean).join(" and ")

	const productsResponse = await icItemsGet({
		path: sagePath(),
		query: {
			...($filter ? { $filter } : {}),
			$top: DEFAULT_PAGE_SIZE,
			$skip: (page - 1) * DEFAULT_PAGE_SIZE,
			$count: true,
		},
	})
	const productsData = productsResponse.data as ICItemListResponseT & { "@odata.count"?: number }
	const sageItems = productsData.value ?? []
	const items = sageItems
		.map(item => toProductListItem(item))
		.filter((item): item is ProductListItem => Boolean(item))
	const total = productsData["@odata.count"] ?? items.length
	const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE))
	const facets = countFacets(items)

	// Attach each item's primary image (stored in object storage, linked by source key).
	const primaryImages = await productImageRepo.listPrimaryBySourceKeys(items.map(item => item.sourceKey))
	const imageUrlByKey = new Map(primaryImages.map(row => [row.source_key, productImagePublicUrl(row.object_key)]))

	return {
		items: items.map(item => ({ ...item, imageUrl: imageUrlByKey.get(item.sourceKey) ?? null })),
		total,
		page,
		pageSize: DEFAULT_PAGE_SIZE,
		totalPages,
		hasPreviousPage: page > 1,
		hasNextPage: page < totalPages,
		facets,
	}
})
