import type { EnquirySummary } from "#shared/types/enquiry"
import { requireSessionUser } from "~~/server/utils/auth"

export default defineEventHandler(async (event): Promise<EnquirySummary[]> => {
	await requireSessionUser(event)

	return []
})
