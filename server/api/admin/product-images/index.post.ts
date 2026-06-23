import { createProductImageSchema } from "#shared/schemas/product-image"
import type { ProductImage } from "#shared/types/product"
import { productImageRepo } from "~~/server/db/repository"
import { auditNonCustomerAction } from "~~/server/utils/audit"
import { requireAdmin } from "~~/server/utils/auth"
import { productImageObjectExists } from "~~/server/utils/objectStorage"
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
	if (!(await productImageObjectExists(body.objectKey))) {
		throw createError({ statusCode: 400, statusMessage: "Uploaded object not found in storage" })
	}

	const row = await productImageRepo.create({
		sourceKey: body.sourceKey,
		objectKey: body.objectKey,
		contentType: body.contentType ?? null,
		alt: body.alt ?? null,
		fileSize: body.fileSize ?? null,
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
