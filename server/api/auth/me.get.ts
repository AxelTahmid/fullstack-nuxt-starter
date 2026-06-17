import { requireSessionUser } from "~~/server/utils/auth"

export default defineEventHandler(async (event) => {
	return requireSessionUser(event)
})
