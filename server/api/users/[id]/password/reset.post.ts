import { auditRepo, userRepo } from "~~/server/db/repository"
import { requireAdmin } from "~~/server/utils/auth"
import { generateTemporaryPassword, hashUserPassword } from "~~/server/utils/password"
import { sendUserCredentialEmail } from "~~/server/utils/user-credential-email"
import { toUserListRow } from "~~/server/utils/user-dto"

function parseId(value: string | undefined) {
	const id = Number.parseInt(value || "", 10)

	if (!Number.isInteger(id) || id <= 0) {
		throw createError({
			statusCode: 400,
			statusMessage: "Valid user id is required",
		})
	}

	return id
}

export default defineEventHandler(async (event) => {
	const actor = await requireAdmin(event)
	const id = parseId(getRouterParam(event, "id"))
	const existing = await userRepo.findUserById(id)
	const ipAddress = getRequestIP(event) ?? null
	const userAgent = getRequestHeader(event, "user-agent") ?? null

	if (!existing) {
		throw createError({
			statusCode: 404,
			statusMessage: "User not found",
		})
	}

	const temporaryPassword = generateTemporaryPassword()
	const user = await userRepo.updatePassword(id, await hashUserPassword(temporaryPassword), true)

	if (!user) {
		throw createError({
			statusCode: 404,
			statusMessage: "User not found",
		})
	}

	await auditRepo.create({
		actorUserId: actor.id,
		action: "user.password_reset",
		targetType: "user",
		targetId: String(user.id),
		summary: `${actor.email} reset password for ${user.email}`,
		metadata: {},
		ipAddress,
		userAgent,
	})

	const origin = getRequestURL(event).origin
	await sendUserCredentialEmail({
		email: user.email,
		name: user.name,
		temporaryPassword,
		reason: "reset",
		loginUrl: new URL("/auth/login", origin).toString(),
	})

	return {
		user: toUserListRow(user),
	}
})
