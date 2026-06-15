import { requireSessionUser } from "~~/server/utils/auth"

export default defineEventHandler(async (event) => {
	await requireSessionUser(event)

	throw createError({
		statusCode: 501,
		statusMessage: "Enquiries are not backed by the current database schema",
	})
})
