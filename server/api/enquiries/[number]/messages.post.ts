import { postMessageSchema } from "#shared/schemas/enquiry"
import type { EnquiryMessage, EnquiryPriority, EnquiryStatus, MessageSenderSide } from "#shared/types/enquiry"
import { enquiryRepo, userRepo } from "~~/server/db/repository"
import { auditNonCustomerAction } from "~~/server/utils/audit"
import { requireSessionUser } from "~~/server/utils/auth"
import { notifyEnquiryMessage } from "~~/server/utils/enquiry-notification-email"
import { publishEnquiryEvent } from "~~/server/utils/enquiryBus"

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

	// Authorship is derived from the real session role: admins answer as support,
	// everyone else writes as the customer who owns the thread.
	const senderSide: MessageSenderSide = sessionUser.role === "admin" ? "support" : "customer"
	const authorName = sessionUser.role === "admin"
		? sessionUser.name || "Support"
		: sessionUser.name || sessionUser.email
	const authorRole = sessionUser.role === "admin" ? "Support" : "Customer"

	const message = await enquiryRepo.addMessage(enquiry.id, {
		authorUserId: sessionUser.id,
		authorName,
		authorRole,
		senderSide,
		body: body.body,
	})

	const dto: EnquiryMessage = {
		id: message.id,
		authorName: message.author_name,
		authorRole: message.author_role,
		senderSide: message.sender_side as MessageSenderSide,
		body: message.body,
		attachmentName: message.attachment_name,
		createdAt: new Date(message.created_at).toISOString(),
	}

	await auditNonCustomerAction(event, sessionUser, {
		action: "enquiry.respond",
		targetType: "enquiry",
		targetId: enquiry.enquiry_number,
		summary: `${sessionUser.email} responded to enquiry ${enquiry.enquiry_number}`,
		metadata: {
			senderSide,
			messageId: message.id,
		},
	})

	publishEnquiryEvent(enquiry.user_id, {
		type: "message",
		enquiryNumber: enquiry.enquiry_number,
		subject: enquiry.subject,
		message: dto,
	})

	// Auto-advance the workflow status: a support reply marks the thread responded
	// (waiting on the customer); a customer reply puts it back to sent (waiting on
	// support), reopening a resolved thread. Deliberate states set in the editor
	// — reviewing/resolved — are preserved where it makes sense.
	const currentStatus = enquiry.status as EnquiryStatus
	const nextStatus: EnquiryStatus | null = senderSide === "support"
		? (currentStatus === "responded" || currentStatus === "resolved" ? null : "responded")
		: (currentStatus === "sent" ? null : "sent")

	if (nextStatus) {
		const updated = await enquiryRepo.updateEnquiry(enquiry.id, { status: nextStatus })
		publishEnquiryEvent(enquiry.user_id, {
			type: "status",
			enquiryNumber: enquiry.enquiry_number,
			status: (updated?.status ?? nextStatus) as EnquiryStatus,
			priority: (updated?.priority ?? enquiry.priority) as EnquiryPriority,
		})
	}

	// Notify the other side by email when they are not actively connected.
	if (senderSide === "customer") {
		const admins = await userRepo.listActiveAdmins()
		await notifyEnquiryMessage({
			enquiryNumber: enquiry.enquiry_number,
			subject: enquiry.subject,
			senderName: dto.authorName,
			senderSide,
			preview: dto.body,
			recipients: admins.map(admin => ({ email: admin.email, name: admin.name })),
			recipientChannel: { kind: "admins" },
		})
	}
	else {
		const owner = await userRepo.findUserById(enquiry.user_id)
		if (owner) {
			await notifyEnquiryMessage({
				enquiryNumber: enquiry.enquiry_number,
				subject: enquiry.subject,
				senderName: dto.authorName,
				senderSide,
				preview: dto.body,
				recipients: [{ email: owner.email, name: owner.name }],
				recipientChannel: { kind: "user", userId: enquiry.user_id },
			})
		}
	}

	return dto
})
