import { userRepo } from "~~/server/utils/db"
import { requireAdmin } from "~~/server/utils/auth"
import { toUserListRow } from "~~/server/utils/user-dto"

export default defineEventHandler(async (event) => {
	await requireAdmin(event)

	const users = await userRepo.listUsers()

	return {
		users: users.map(toUserListRow),
	}
})
