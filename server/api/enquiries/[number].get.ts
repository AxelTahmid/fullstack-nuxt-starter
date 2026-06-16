import type { EnquiryMessage, EnquiryPriority, EnquiryStatus, EnquiryThread } from "#shared/types/enquiry"
import { enquiryRepo } from "~~/server/db/repository"
import { requireSessionUser } from "~~/server/utils/auth"

export default defineEventHandler(async (event): Promise<EnquiryThread> => {
	const sessionUser = await requireSessionUser(event)
	const number = getRouterParam(event, "number")?.trim()

	if (!number) {
		throw createError({
			statusCode: 400,
			statusMessage: "Enquiry number is required",
		})
	}

	const enquiry = await enquiryRepo.findByNumber(number)
	if (!enquiry || (sessionUser.role !== "admin" && enquiry.user_id !== sessionUser.id)) {
		throw createError({
			statusCode: 404,
			statusMessage: "Enquiry not found",
		})
	}

	const messages = await enquiryRepo.listMessages(enquiry.id)

	return {
		id: enquiry.id,
		enquiryNumber: enquiry.enquiry_number,
		subject: enquiry.subject,
		productSku: enquiry.product_sku,
		supplierName: enquiry.supplier_name,
		status: enquiry.status as EnquiryStatus,
		priority: enquiry.priority as EnquiryPriority,
		createdAt: new Date(enquiry.created_at).toISOString(),
		messages: messages.map((message): EnquiryMessage => ({
			id: message.id,
			authorName: message.author_name,
			authorRole: message.author_role,
			body: message.body,
			attachmentName: message.attachment_name,
			createdAt: new Date(message.created_at).toISOString(),
		})),
	}
})
