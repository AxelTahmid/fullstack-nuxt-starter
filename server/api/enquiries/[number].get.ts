import type { EnquiryMessage, EnquiryPriority, EnquirySourceType, EnquiryStatus, EnquiryThread, MessageSenderSide } from "#shared/types/enquiry"
import { enquiryRepo, userRepo } from "~~/server/db/repository"
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

	const [messages, readMarkers, owner] = await Promise.all([
		enquiryRepo.listMessages(enquiry.id),
		enquiryRepo.getReadMarkers(enquiry.id),
		userRepo.findUserById(enquiry.user_id),
	])

	return {
		id: enquiry.id,
		enquiryNumber: enquiry.enquiry_number,
		subject: enquiry.subject,
		productSku: enquiry.product_sku,
		supplierName: enquiry.supplier_name,
		status: enquiry.status as EnquiryStatus,
		priority: enquiry.priority as EnquiryPriority,
		sourceType: enquiry.source_type as EnquirySourceType,
		sourceReference: enquiry.source_reference,
		createdAt: new Date(enquiry.created_at).toISOString(),
		customerName: owner?.name ?? null,
		customerEmail: owner?.email ?? "",
		viewerSide: sessionUser.role === "admin" ? "support" : "customer",
		customerLastReadMessageId: readMarkers.customer,
		supportLastReadMessageId: readMarkers.support,
		messages: messages.map((message): EnquiryMessage => ({
			id: message.id,
			authorName: message.author_name,
			authorRole: message.author_role,
			senderSide: message.sender_side as MessageSenderSide,
			body: message.body,
			attachmentName: message.attachment_name,
			createdAt: new Date(message.created_at).toISOString(),
		})),
	}
})
