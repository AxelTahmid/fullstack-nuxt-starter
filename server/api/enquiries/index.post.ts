import { createEnquirySchema } from "#shared/schemas/enquiry"
import type { EnquiryCreateResponse } from "#shared/types/enquiry"
import { enquiryRepo } from "~~/server/db/repository"
import { auditNonCustomerAction } from "~~/server/utils/audit"
import { requireSessionUser } from "~~/server/utils/auth"

function enquiryNumber() {
	const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14)
	const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()

	return `ENQ-${stamp}-${suffix}`
}

export default defineEventHandler(async (event): Promise<EnquiryCreateResponse> => {
	const sessionUser = await requireSessionUser(event)
	const body = await readValidatedBody(event, createEnquirySchema.parse)

	const enquiry = await enquiryRepo.createWithFirstMessage({
		userId: sessionUser.id,
		enquiryNumber: enquiryNumber(),
		subject: body.subject,
		supplierName: body.supplierName,
		productSku: body.productSku?.trim() || null,
		priority: body.priority,
		firstMessage: {
			authorUserId: sessionUser.id,
			authorName: sessionUser.name || sessionUser.email,
			authorRole: "Buyer",
			body: body.initialMessage,
		},
	})

	await auditNonCustomerAction(event, sessionUser, {
		action: "enquiry.create",
		targetType: "enquiry",
		targetId: enquiry.enquiry_number,
		summary: `${sessionUser.email} created enquiry ${enquiry.enquiry_number}`,
		metadata: {
			priority: enquiry.priority,
			productSku: enquiry.product_sku,
		},
	})

	return {
		enquiryNumber: enquiry.enquiry_number,
	}
})
