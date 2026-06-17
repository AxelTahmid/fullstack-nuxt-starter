import { log } from "#shared/log"
import { auditNonCustomerAction } from "~~/server/utils/audit"
import type { SessionUser } from "~~/server/utils/auth"

export default defineEventHandler(async (event) => {
	const session = await getUserSession(event) as { user?: SessionUser }

	if (session.user) {
		log.info({ userId: session.user.id }, "User logging out")
		await auditNonCustomerAction(event, session.user, {
			action: "auth.logout",
			targetType: "user",
			targetId: String(session.user.id),
			summary: `${session.user.email} signed out`,
			metadata: {},
		})
	}

	await clearUserSession(event)

	return {
		success: true,
	}
})
