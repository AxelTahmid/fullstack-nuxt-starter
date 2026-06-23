import type { ProductImage } from "#shared/types/product"
import { productImageRepo } from "~~/server/db/repository"
import { requireAdmin } from "~~/server/utils/auth"
import { toProductImageDto } from "~~/server/utils/productImage"

/** Admin-only. Lists the images for a product (by Sage source key). */
export default defineEventHandler(async (event): Promise<ProductImage[]> => {
	await requireAdmin(event)
	const sourceKey = typeof getQuery(event).sourceKey === "string" ? (getQuery(event).sourceKey as string).trim() : ""

	if (!sourceKey) {
		throw createError({ statusCode: 400, statusMessage: "sourceKey is required" })
	}

	const rows = await productImageRepo.listBySourceKey(sourceKey)
	return rows.map(toProductImageDto)
})
