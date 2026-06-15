import { authRepo } from "~~/server/utils/db"

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

	await setUserSession(event, {
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			email_verified: true,
			last_active_at: user.last_active_at,
			created_at: user.created_at,
		},
	})

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
