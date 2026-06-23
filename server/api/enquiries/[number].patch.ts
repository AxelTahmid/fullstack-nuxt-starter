import { updateEnquirySchema } from "#shared/schemas/enquiry"
import type { EnquiryPriority, EnquiryStatus } from "#shared/types/enquiry"
import { enquiryRepo } from "~~/server/db/repository"
import { requireAdmin } from "~~/server/utils/auth"
import { publishEnquiryEvent } from "~~/server/utils/enquiryBus"

export default defineEventHandler(async (event): Promise<{ status: EnquiryStatus, priority: EnquiryPriority }> => {
	// Status and priority are admin-only triage controls; customers cannot mutate them.
	await requireAdmin(event)
	const number = getRouterParam(event, "number")?.trim()

	if (!number) {
		throw createError({
			statusCode: 400,
			statusMessage: "Enquiry number is required",
		})
	}

	const enquiry = await enquiryRepo.findByNumber(number)
	if (!enquiry) {
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

	const status = (updated?.status ?? enquiry.status) as EnquiryStatus
	const priority = (updated?.priority ?? enquiry.priority) as EnquiryPriority

	publishEnquiryEvent(enquiry.user_id, {
		type: "status",
		enquiryNumber: enquiry.enquiry_number,
		status,
		priority,
	})

	return { status, priority }
})
