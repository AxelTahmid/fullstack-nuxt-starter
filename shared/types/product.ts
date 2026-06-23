export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "made_to_order"

/** A product image stored in object storage, linked to a Sage product by source key. */
export interface ProductImage {
	id: number
	url: string
	alt: string | null
	isPrimary: boolean
	sortOrder: number
}

/** Admin upload: the presigned target the browser PUTs the file to, plus the key to record after. */
export interface ProductImageUploadTarget {
	objectKey: string
	uploadUrl: string
}

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
