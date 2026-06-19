import { createEnquirySchema } from "#shared/schemas/enquiry"
import type { EnquiryCreateResponse, EnquiryMessage } from "#shared/types/enquiry"
import { enquiryRepo, userRepo } from "~~/server/db/repository"
import { auditNonCustomerAction } from "~~/server/utils/audit"
import { requireSessionUser } from "~~/server/utils/auth"
import { notifyEnquiryMessage } from "~~/server/utils/enquiry-notification-email"
import { publishEnquiryEvent } from "~~/server/utils/enquiryBus"

function enquiryNumber() {
	const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14)
	const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()

	return `ENQ-${stamp}-${suffix}`
}

export default defineEventHandler(async (event): Promise<EnquiryCreateResponse> => {
	const sessionUser = await requireSessionUser(event)

	// Enquiries originate from customers only; admins are reply-only triage.
	if (sessionUser.role === "admin") {
		throw createError({
			statusCode: 403,
			statusMessage: "Admins cannot create enquiries",
		})
	}

	const body = await readValidatedBody(event, createEnquirySchema.parse)

	const { enquiry, firstMessage } = await enquiryRepo.createWithFirstMessage({
		userId: sessionUser.id,
		enquiryNumber: enquiryNumber(),
		subject: body.subject,
		supplierName: body.supplierName,
		productSku: body.productSku?.trim() || null,
		priority: body.priority,
		firstMessage: {
			authorUserId: sessionUser.id,
			authorName: sessionUser.name || sessionUser.email,
			authorRole: "Customer",
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

	const dto: EnquiryMessage = {
		id: firstMessage.id,
		authorName: firstMessage.author_name,
		authorRole: firstMessage.author_role,
		senderSide: "customer",
		body: firstMessage.body,
		attachmentName: firstMessage.attachment_name,
		createdAt: new Date(firstMessage.created_at).toISOString(),
	}

	// Surface the new enquiry to admins live, and email those not connected.
	publishEnquiryEvent(enquiry.user_id, {
		type: "message",
		enquiryNumber: enquiry.enquiry_number,
		subject: enquiry.subject,
		message: dto,
	})

	const admins = await userRepo.listActiveAdmins()
	await notifyEnquiryMessage({
		enquiryNumber: enquiry.enquiry_number,
		subject: enquiry.subject,
		senderName: dto.authorName,
		senderSide: "customer",
		preview: dto.body,
		recipients: admins.map(admin => ({ email: admin.email, name: admin.name })),
		recipientChannel: { kind: "admins" },
	})

	return {
		enquiryNumber: enquiry.enquiry_number,
	}
})
