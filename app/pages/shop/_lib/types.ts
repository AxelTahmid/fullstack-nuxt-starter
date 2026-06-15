import type { ProductListResponse } from "#shared/types/product"

export type ProductFacet = ProductListResponse["facets"]["categories"][number]
