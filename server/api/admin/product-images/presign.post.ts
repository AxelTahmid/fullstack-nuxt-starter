import { presignProductImageSchema } from "#shared/schemas/product-image"
import type { ProductImageUploadTarget } from "#shared/types/product"
import { requireAdmin } from "~~/server/utils/auth"
import { buildProductImageKey, presignProductImageUpload } from "~~/server/utils/objectStorage"

/**
 * Admin-only. Returns a short-lived presigned PUT URL the browser uploads the file
 * to directly, plus the object key to record afterwards via POST /api/admin/product-images.
 */
export default defineEventHandler(async (event): Promise<ProductImageUploadTarget> => {
	await requireAdmin(event)
	const body = await readValidatedBody(event, presignProductImageSchema.parse)

	const objectKey = buildProductImageKey(body.sourceKey, body.fileName)
	const uploadUrl = await presignProductImageUpload(objectKey)

	return { objectKey, uploadUrl }
})
