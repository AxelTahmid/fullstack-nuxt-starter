import { changePasswordSchema } from "#shared/schemas/user"
import { userRepo } from "~~/server/db/repository"
import { auditNonCustomerAction } from "~~/server/utils/audit"
import { requireSessionUser, toSessionUser } from "~~/server/utils/auth"
import { authRepo } from "~~/server/utils/db"
import { hashUserPassword, verifyUserPassword } from "~~/server/utils/password"

export default defineEventHandler(async (event) => {
	const sessionUser = await requireSessionUser(event)
	const body = await readValidatedBody(event, changePasswordSchema.parse)
	const user = await authRepo.findUserById(sessionUser.id)

	if (!user) {
		throw createError({
			statusCode: 404,
			statusMessage: "User not found",
		})
	}

	if (!(await verifyUserPassword(body.currentPassword, user.password_hash))) {
		throw createError({
			statusCode: 401,
			statusMessage: "Current password is incorrect",
		})
	}

	const updated = await userRepo.updatePassword(user.id, await hashUserPassword(body.newPassword), false)

	if (!updated) {
		throw createError({
			statusCode: 404,
			statusMessage: "User not found",
		})
	}

	await setUserSession(event, { user: toSessionUser(updated) })

	await auditNonCustomerAction(event, toSessionUser(updated), {
		action: "auth.password_change",
		targetType: "user",
		targetId: String(updated.id),
		summary: `${updated.email} changed password`,
		metadata: {
			wasRequired: user.password_reset_required,
		},
	})

	return {
		success: true,
	}
})
