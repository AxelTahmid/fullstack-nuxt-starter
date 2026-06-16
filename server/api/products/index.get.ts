import type {
	ICItemListResponseT,
	ICItemT,
} from "#shared/sage300"
import {
	icItemsGet,
} from "#shared/sage300"
import type { ProductListItem, ProductListResponse } from "#shared/types/product"
import { requireSessionUser } from "~~/server/utils/auth"

const DEFAULT_PAGE_SIZE = 24
const DEFAULT_MANUFACTURER = "Manufacturer unavailable"

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

	const productsResponse = await icItemsGet({
		path: sagePath(),
		query: {
			...(filter ? { $filter: filter } : {}),
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

	return {
		items,
		total,
		page,
		pageSize: DEFAULT_PAGE_SIZE,
		totalPages,
		hasPreviousPage: page > 1,
		hasNextPage: page < totalPages,
		facets,
	}
})
