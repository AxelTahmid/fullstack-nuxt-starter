import { updateEnquirySchema } from "#shared/schemas/enquiry"
import type { EnquiryPriority, EnquiryStatus } from "#shared/types/enquiry"
import { enquiryRepo } from "~~/server/db/repository"
import { requireSessionUser } from "~~/server/utils/auth"

export default defineEventHandler(async (event): Promise<{ status: EnquiryStatus, priority: EnquiryPriority }> => {
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

	const body = await readValidatedBody(event, updateEnquirySchema.parse)
	const updated = await enquiryRepo.updateEnquiry(enquiry.id, {
		status: body.status,
		priority: body.priority,
	})

	return {
		status: (updated?.status ?? enquiry.status) as EnquiryStatus,
		priority: (updated?.priority ?? enquiry.priority) as EnquiryPriority,
	}
})
