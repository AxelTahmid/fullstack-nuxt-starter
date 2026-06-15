import { requireSessionUser } from "~~/server/utils/auth"

export default defineEventHandler(async (event) => {
	await requireSessionUser(event)

	throw createError({
		statusCode: 501,
		statusMessage: "Orders are pending Sage-backed cart planning",
	})
})
