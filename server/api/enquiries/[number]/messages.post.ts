import { postMessageSchema } from "#shared/schemas/enquiry"
import type { EnquiryMessage } from "#shared/types/enquiry"
import { enquiryRepo } from "~~/server/db/repository"
import { auditNonCustomerAction } from "~~/server/utils/audit"
import { requireSessionUser } from "~~/server/utils/auth"

export default defineEventHandler(async (event): Promise<EnquiryMessage> => {
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

	const body = await readValidatedBody(event, postMessageSchema.parse)
	const message = await enquiryRepo.addMessage(enquiry.id, body.asSupplier
		? {
				authorUserId: null,
				authorName: enquiry.supplier_name,
				authorRole: "Supplier",
				body: body.body,
			}
		: {
				authorUserId: sessionUser.id,
				authorName: sessionUser.name || sessionUser.email,
				authorRole: "Buyer",
				body: body.body,
			})

	await auditNonCustomerAction(event, sessionUser, {
		action: "enquiry.respond",
		targetType: "enquiry",
		targetId: enquiry.enquiry_number,
		summary: `${sessionUser.email} responded to enquiry ${enquiry.enquiry_number}`,
		metadata: {
			asSupplier: body.asSupplier,
			messageId: message.id,
		},
	})

	return {
		id: message.id,
		authorName: message.author_name,
		authorRole: message.author_role,
		body: message.body,
		attachmentName: message.attachment_name,
		createdAt: new Date(message.created_at).toISOString(),
	}
})
