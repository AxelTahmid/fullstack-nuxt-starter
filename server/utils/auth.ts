import type { H3Event } from "h3"
import type { UserRole } from "#shared/types/user"
import { authRepo } from "~~/server/utils/db"

export interface SessionUser {
	id: number
	email: string
	name: string | null
	role: UserRole
	email_verified: boolean
	password_reset_required: boolean
	last_active_at: Date | null
	created_at: Date
}

function isUserRole(role: string): role is UserRole {
	return role === "admin" || role === "customer"
}

function canUseTemporaryPasswordSession(event: H3Event) {
	const pathname = getRequestURL(event).pathname

	return pathname === "/api/auth/password/change"
		|| pathname === "/api/auth/logout"
		|| pathname === "/api/auth/me"
}

export function toSessionUser(user: Awaited<ReturnType<typeof authRepo.findUserById>>): SessionUser {
	if (!user) {
		throw new Error("Cannot build session from missing user")
	}

	return {
		id: user.id,
		email: user.email,
		name: user.name,
		role: isUserRole(user.role) ? user.role : "customer",
		email_verified: user.email_verified,
		password_reset_required: user.password_reset_required,
		last_active_at: user.last_active_at,
		created_at: user.created_at,
	}
}

export async function requireSessionUser(event: H3Event) {
	const session = await getUserSession(event) as { user?: SessionUser }

	if (!session.user) {
		throw createError({
			statusCode: 401,
			statusMessage: "Unauthorized",
		})
	}

	let user = await authRepo.findUserById(session.user.id)
	if (!user && session.user.email) {
		user = await authRepo.findUserByEmail(session.user.email)
	}

	if (!user) {
		await clearUserSession(event)
		throw createError({
			statusCode: 401,
			statusMessage: "Session user no longer exists",
		})
	}

	if (user.deactivated) {
		await clearUserSession(event)
		throw createError({
			statusCode: 403,
			statusMessage: "Account is deactivated",
		})
	}

	if (user.password_reset_required && !canUseTemporaryPasswordSession(event)) {
		throw createError({
			statusCode: 403,
			statusMessage: "Password change required",
		})
	}

	const sessionUser = toSessionUser(user)
	if (
		sessionUser.id !== session.user.id
		|| sessionUser.email !== session.user.email
		|| sessionUser.role !== session.user.role
		|| sessionUser.password_reset_required !== session.user.password_reset_required
	) {
		await setUserSession(event, { user: sessionUser })
	}

	return sessionUser
}

export async function requireRole(event: H3Event, roles: UserRole[]) {
	const user = await requireSessionUser(event)

	if (!roles.includes(user.role)) {
		throw createError({
			statusCode: 403,
			statusMessage: "Forbidden",
		})
	}

	return user
}

export async function requireAdmin(event: H3Event) {
	return requireRole(event, ["admin"])
}
