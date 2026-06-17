import { authRepo } from "~~/server/utils/db"
import { toSessionUser } from "~~/server/utils/auth"

const DEMO_EMAIL = "demo@supplykey.ca"

export default defineEventHandler(async (event) => {
	const runtimeConfig = useRuntimeConfig()

	if (!runtimeConfig.public.demoMode) {
		throw createError({
			statusCode: 404,
			statusMessage: "Demo mode is not enabled",
		})
	}

	const user = await authRepo.findUserByEmail(DEMO_EMAIL)

	if (!user) {
		throw createError({
			statusCode: 500,
			statusMessage: "Demo customer not seeded. Run `make db-seed`.",
		})
	}

	if (user.deactivated) {
		throw createError({
			statusCode: 403,
			statusMessage: "Demo user is deactivated",
		})
	}

	await authRepo.updateLastActive(user.id)

	await setUserSession(event, { user: toSessionUser({ ...user, email_verified: true }) })

	return {
		success: true,
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
		},
	}
})
