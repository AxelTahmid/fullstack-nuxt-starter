export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "made_to_order"

export interface ProductListItem {
	id: number | null
	sourceKey: string
	sku: string
	name: string
	description: string
	category: string
	manufacturer: string
	imageUrl: string | null
	/** Effective price (sale price when on sale, otherwise base). */
	priceCents: number | null
	basePriceCents: number | null
	salePriceCents: number | null
	onSale: boolean
	currencyCode: string
	stockStatus: StockStatus
	tags: string[]
}

export interface ProductFilters {
	category?: string
	manufacturer?: string
	q?: string
	page?: number
}

export interface ProductListResponse {
	items: ProductListItem[]
	total: number
	page: number
	pageSize: number
	totalPages: number
	hasPreviousPage: boolean
	hasNextPage: boolean
	facets: {
		categories: Array<{ value: string, count: number }>
		manufacturers: Array<{ value: string, count: number }>
	}
}
