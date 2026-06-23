import type { ProductImage } from "#shared/types/product"
import { productImagePublicUrl } from "~~/server/utils/objectStorage"

interface ProductImageRow {
	id: number
	object_key: string
	alt: string | null
	is_primary: boolean
	sort_order: number
}

/** Map a stored product-image row to the frontend DTO (with its public URL). */
export function toProductImageDto(row: ProductImageRow): ProductImage {
	return {
		id: row.id,
		url: productImagePublicUrl(row.object_key),
		alt: row.alt,
		isPrimary: row.is_primary,
		sortOrder: row.sort_order,
	}
}
