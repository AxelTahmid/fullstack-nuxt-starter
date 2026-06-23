import { updateProductImageSchema } from "#shared/schemas/product-image"
import type { ProductImage } from "#shared/types/product"
import { productImageRepo } from "~~/server/db/repository"
import { requireAdmin } from "~~/server/utils/auth"
import { toProductImageDto } from "~~/server/utils/productImage"

/** Admin-only. Set primary, edit alt text, or reorder a product image. */
export default defineEventHandler(async (event): Promise<ProductImage> => {
	await requireAdmin(event)
	const id = Number.parseInt(getRouterParam(event, "id") ?? "", 10)
	if (!Number.isInteger(id)) {
		throw createError({ statusCode: 400, statusMessage: "Invalid image id" })
	}

	const body = await readValidatedBody(event, updateProductImageSchema.parse)

	let row = await productImageRepo.findById(id)
	if (!row) {
		throw createError({ statusCode: 404, statusMessage: "Image not found" })
	}

	if (body.isPrimary) {
		row = (await productImageRepo.setPrimary(id)) ?? row
	}
	if (body.alt !== undefined || body.sortOrder !== undefined) {
		row = (await productImageRepo.updateMeta(id, { alt: body.alt, sortOrder: body.sortOrder })) ?? row
	}

	return toProductImageDto(row)
})
