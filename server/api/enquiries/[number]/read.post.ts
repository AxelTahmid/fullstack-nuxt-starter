import type { EnquiryReadResponse, MessageSenderSide } from "#shared/types/enquiry"
import { enquiryRepo } from "~~/server/db/repository"
import { requireSessionUser } from "~~/server/utils/auth"
import { publishEnquiryEvent } from "~~/server/utils/enquiryBus"

/**
 * Mark the requesting viewer's side as read up to the latest message in the thread.
 * Idempotent (the marker only advances forward) and publishes a `read` event so the
 * other side's "Seen" receipt updates live.
 */
export default defineEventHandler(async (event): Promise<EnquiryReadResponse> => {
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

	const side: MessageSenderSide = sessionUser.role === "admin" ? "support" : "customer"
	const latestMessageId = await enquiryRepo.getLatestMessageId(enquiry.id)

	if (latestMessageId === null) {
		return { side, lastReadMessageId: null }
	}

	const lastReadMessageId = await enquiryRepo.markRead(enquiry.id, side, latestMessageId)

	publishEnquiryEvent(enquiry.user_id, {
		type: "read",
		enquiryNumber: enquiry.enquiry_number,
		side,
		lastReadMessageId,
	})

	return { side, lastReadMessageId }
})
