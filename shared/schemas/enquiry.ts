import { z } from "zod"

export const enquiryPriorityEnum = z.enum(["low", "medium", "high", "urgent"])
export const enquiryStatusEnum = z.enum(["sent", "received", "reviewing", "responded", "resolved"])
// The kind of Sage document an enquiry is linked to. `general` = no document link.
export const enquirySourceTypeEnum = z.enum(["general", "order", "quote"])

export const createEnquirySchema = z.object({
	subject: z.string().min(1, "Subject is required").max(200),
	supplierName: z.string().min(1, "Supplier is required").max(200),
	productSku: z.string().max(80).optional(),
	// Optional linkage to a Sage document (OE order/quote) the enquiry is about.
	sourceType: enquirySourceTypeEnum.optional(),
	sourceReference: z.string().max(80).optional(),
	initialMessage: z.string().min(1, "Initial message is required").max(4000),
})

export const postMessageSchema = z.object({
	body: z.string().min(1, "Message body is required").max(4000),
})

export const updateEnquirySchema = z.object({
	status: enquiryStatusEnum.optional(),
	priority: enquiryPriorityEnum.optional(),
}).refine(v => v.status !== undefined || v.priority !== undefined, {
	message: "At least one of status or priority is required",
})

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>
export type PostMessageInput = z.infer<typeof postMessageSchema>
export type UpdateEnquiryInput = z.infer<typeof updateEnquirySchema>
