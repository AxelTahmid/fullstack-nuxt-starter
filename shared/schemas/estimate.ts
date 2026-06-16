import { z } from "zod"

export const estimateItemSchema = z.object({
	sourceKey: z.string().trim().min(1),
	quantity: z.number().int().positive(),
})

export const createEstimateSchema = z.object({
	deliverySite: z.string().min(1, "Delivery site is required"),
	deliveryContact: z.string().optional(),
	requestedShipDate: z.string().optional(),
	projectReference: z.string().max(120).optional(),
	notes: z.string().max(4000).optional(),
	budgetRange: z.string().max(120).optional(),
	items: z.array(estimateItemSchema).optional(),
})

export type EstimateItemInput = z.infer<typeof estimateItemSchema>
export type CreateEstimateInput = z.infer<typeof createEstimateSchema>
