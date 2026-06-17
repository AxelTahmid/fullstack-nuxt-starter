import { z } from "zod"
import { auditNonCustomerAction } from "~~/server/utils/audit"
import { toSessionUser } from "~~/server/utils/auth"
import { authRepo } from "~~/server/utils/db"

const bodySchema = z.object({
	token: z.string().min(1, "Token is required"),
})

export default defineEventHandler(async (event) => {
	const { token } = await readValidatedBody(event, bodySchema.parse)
	const user = await authRepo.verifyAuthToken(token)

	if (!user) {
		throw createError({
			statusCode: 401,
			statusMessage: "Invalid, expired, or already used token",
		})
	}

	if (user.deactivated) {
		throw createError({
			statusCode: 403,
			statusMessage: "Account is deactivated",
		})
	}

	if (!user.email_verified) {
		await authRepo.updateEmailVerified(user.id)
	}

	await authRepo.updateLastActive(user.id)

	const sessionUser = toSessionUser({ ...user, email_verified: true })
	await setUserSession(event, { user: sessionUser })

	await auditNonCustomerAction(event, sessionUser, {
		action: "auth.magic_link_login",
		targetType: "user",
		targetId: String(user.id),
		summary: `${user.email} signed in with magic link`,
		metadata: {},
	})

	return {
		success: true,
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			email_verified: true,
		},
	}
})
