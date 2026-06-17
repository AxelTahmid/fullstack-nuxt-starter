import { z } from "zod"
import { auditRepo, authRepo } from "~~/server/db/repository"
import { toSessionUser } from "~~/server/utils/auth"
import { verifyUserPassword } from "~~/server/utils/password"

const bodySchema = z.object({
	email: z.string().trim().email("Valid email is required"),
	password: z.string().min(1, "Password is required"),
})

function shouldAuditUser(user: { role: string } | undefined) {
	return Boolean(user && user.role !== "customer")
}

export default defineEventHandler(async (event) => {
	const { email, password } = await readValidatedBody(event, bodySchema.parse)
	const user = await authRepo.findUserByEmail(email)
	const ipAddress = getRequestIP(event) ?? null
	const userAgent = getRequestHeader(event, "user-agent") ?? null

	if (!user || !(await verifyUserPassword(password, user.password_hash))) {
		if (shouldAuditUser(user)) {
			await auditRepo.create({
				actorUserId: user?.id ?? null,
				action: "auth.password_login_failed",
				targetType: "user",
				targetId: user ? String(user.id) : email.toLowerCase(),
				summary: `Failed password login for ${email.toLowerCase()}`,
				metadata: {},
				ipAddress,
				userAgent,
			})
		}

		throw createError({
			statusCode: 401,
			statusMessage: "Invalid email or password",
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

	if (shouldAuditUser(user)) {
		await auditRepo.create({
			actorUserId: user.id,
			action: "auth.password_login",
			targetType: "user",
			targetId: String(user.id),
			summary: `${user.email} signed in with password`,
			metadata: {},
			ipAddress,
			userAgent,
		})
	}

	return {
		success: true,
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			role: sessionUser.role,
			email_verified: true,
			passwordResetRequired: user.password_reset_required,
		},
	}
})
