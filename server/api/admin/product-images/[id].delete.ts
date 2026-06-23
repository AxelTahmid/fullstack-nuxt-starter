import { productImageRepo } from "~~/server/db/repository"
import { auditNonCustomerAction } from "~~/server/utils/audit"
import { requireAdmin } from "~~/server/utils/auth"
import { removeProductImageObject } from "~~/server/utils/objectStorage"

/** Admin-only. Removes an image (the storage object and its row). */
export default defineEventHandler(async (event) => {
	const admin = await requireAdmin(event)
	const id = Number.parseInt(getRouterParam(event, "id") ?? "", 10)
	if (!Number.isInteger(id)) {
		throw createError({ statusCode: 400, statusMessage: "Invalid image id" })
	}

	const removed = await productImageRepo.delete(id)
	if (!removed) {
		throw createError({ statusCode: 404, statusMessage: "Image not found" })
	}

	try {
		await removeProductImageObject(removed.object_key)
	}
	catch {
		// Row is gone; object cleanup is best-effort (a stray object is harmless).
	}

	await auditNonCustomerAction(event, admin, {
		action: "product_image.remove",
		targetType: "product",
		targetId: removed.source_key,
		summary: `${admin.email} removed an image from product ${removed.source_key}`,
		metadata: { imageId: id, objectKey: removed.object_key },
	})

	return { success: true }
})
