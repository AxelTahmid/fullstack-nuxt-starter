import { z } from "zod"

/** Hard ceiling for a single product image, shared by client and server validation. */
export const MAX_PRODUCT_IMAGE_BYTES = 2 * 1024 * 1024 // 2 MB

const imageContentType = z.string().regex(/^image\/(png|jpe?g|webp|gif|avif)$/i, "Only PNG, JPEG, WebP, GIF, or AVIF images are allowed")

export const presignProductImageSchema = z.object({
	sourceKey: z.string().trim().min(1).max(120),
	fileName: z.string().trim().min(1).max(200),
	contentType: imageContentType,
	fileSize: z.number().int().positive().max(MAX_PRODUCT_IMAGE_BYTES, "Each image must be 2 MB or smaller").optional(),
})

export const createProductImageSchema = z.object({
	sourceKey: z.string().trim().min(1).max(120),
	objectKey: z.string().trim().min(1).max(300),
	contentType: imageContentType.optional(),
	fileSize: z.number().int().nonnegative().max(MAX_PRODUCT_IMAGE_BYTES, "Each image must be 2 MB or smaller").optional(),
	alt: z.string().max(300).optional(),
})

export const updateProductImageSchema = z.object({
	isPrimary: z.literal(true).optional(),
	alt: z.string().max(300).nullable().optional(),
	sortOrder: z.number().int().nonnegative().optional(),
}).refine(v => v.isPrimary !== undefined || v.alt !== undefined || v.sortOrder !== undefined, {
	message: "At least one field is required",
})

export type PresignProductImageInput = z.infer<typeof presignProductImageSchema>
export type CreateProductImageInput = z.infer<typeof createProductImageSchema>
export type UpdateProductImageInput = z.infer<typeof updateProductImageSchema>
