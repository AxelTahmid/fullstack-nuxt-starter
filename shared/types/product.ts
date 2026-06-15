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
	priceCents: number | null
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

export interface ProductPricingDetail {
	currencyCode: string
	priceListCode: string | null
	unitPriceCents: number | null
	basePriceCents: number | null
	salePriceCents: number | null
	unitOfMeasure: string | null
	saleStartsOn: string | null
	saleEndsOn: string | null
	unavailableReason: string | null
}

export interface ProductInventoryDetail {
	quantityOnHand: number | null
	quantityAvailable: number | null
	quantityCommitted: number | null
	quantityOnPurchaseOrder: number | null
	quantityOnSalesOrder: number | null
	stockingUnitOfMeasure: string | null
	weightUnitOfMeasure: string | null
	unitWeight: number | null
}

export interface ProductSageDetail {
	itemNumber: string
	unformattedItemNumber: string
	accountSetCode: string | null
	defaultPriceListCode: string | null
	preferredVendorItem: string | null
	tariffCode: string | null
	stockItem: boolean | null
	sellable: boolean | null
	active: boolean | null
	dateLastMaintained: string | null
	dateInactive: string | null
}

export interface ProductDetailResponse {
	product: ProductListItem
	pricing: ProductPricingDetail
	inventory: ProductInventoryDetail
	sage: ProductSageDetail
	comments: string[]
}
