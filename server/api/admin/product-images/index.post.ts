import { createProductImageSchema, MAX_PRODUCT_IMAGE_BYTES } from "#shared/schemas/product-image"
import type { ProductImage } from "#shared/types/product"
import { productImageRepo } from "~~/server/db/repository"
import { auditNonCustomerAction } from "~~/server/utils/audit"
import { requireAdmin } from "~~/server/utils/auth"
import { removeProductImageObject, statProductImageObject } from "~~/server/utils/objectStorage"
import { toProductImageDto } from "~~/server/utils/productImage"

/** Admin-only. Records an uploaded image (call after the browser PUTs to the presigned URL). */
export default defineEventHandler(async (event): Promise<ProductImage> => {
	const admin = await requireAdmin(event)
	const body = await readValidatedBody(event, createProductImageSchema.parse)

	// Guard against arbitrary keys and orphan rows: the object must be under the
	// product prefix and actually exist in storage.
	if (!body.objectKey.startsWith("products/")) {
		throw createError({ statusCode: 400, statusMessage: "Invalid object key" })
	}
	const stat = await statProductImageObject(body.objectKey)
	if (!stat) {
		throw createError({ statusCode: 400, statusMessage: "Uploaded object not found in storage" })
	}
	// Enforce the size cap on the actually-stored bytes (the presigned PUT itself
	// can't); drop the oversized object so we never keep an unreferenced blob.
	if (stat.size > MAX_PRODUCT_IMAGE_BYTES) {
		// eslint-disable-next-line harlanzw/no-silent-catch -- best-effort cleanup of the rejected blob; the 413 below is what matters
		void removeProductImageObject(body.objectKey).catch(() => {})
		throw createError({ statusCode: 413, statusMessage: "Image exceeds the 2 MB limit" })
	}

	const row = await productImageRepo.create({
		sourceKey: body.sourceKey,
		objectKey: body.objectKey,
		contentType: body.contentType ?? null,
		alt: body.alt ?? null,
		fileSize: body.fileSize ?? stat.size,
		createdBy: admin.id,
	})

	await auditNonCustomerAction(event, admin, {
		action: "product_image.add",
		targetType: "product",
		targetId: body.sourceKey,
		summary: `${admin.email} added an image to product ${body.sourceKey}`,
		metadata: { imageId: row.id, objectKey: row.object_key },
	})

	return toProductImageDto(row)
})
