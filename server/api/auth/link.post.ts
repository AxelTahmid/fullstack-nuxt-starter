import { z } from "zod"
import { log } from "#shared/log"
import type { Queue } from "~~/server/db/queue"
import { auditNonCustomerAction } from "~~/server/utils/audit"
import { toSessionUser } from "~~/server/utils/auth"
import { authRepo, userRepo } from "~~/server/utils/db"
import { sendMail } from "~~/server/utils/mailer"

const bodySchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	redirect: z.string().startsWith("/").optional(),
})

export default defineEventHandler(async (event) => {
	const { email, redirect } = await readValidatedBody(event, bodySchema.parse)
	const runtimeConfig = useRuntimeConfig()
	const appName = runtimeConfig.public.appName
	const ttlMinutes = runtimeConfig.auth.magicLinkTtlMinutes

	let user = await authRepo.findUserByEmail(email)

	if (!user) {
		const isFirstUser = await userRepo.countUsers() === 0
		if (!isFirstUser) {
			return {
				success: true,
				message: "If an account exists for this email, a magic link will arrive shortly.",
				expires_in: ttlMinutes * 60,
			}
		}

		user = await authRepo.createUser(email, "admin")
		log.info({ email, role: user.role }, "Created user")
	}

	const ipAddress = getRequestIP(event)
	const userAgent = getRequestHeader(event, "user-agent")
	const authToken = await authRepo.createAuthToken(user.id, ttlMinutes, ipAddress, userAgent)

	const origin = getRequestURL(event).origin
	const magicLinkUrl = new URL("/auth/verify", origin)
	magicLinkUrl.searchParams.set("token", authToken)

	if (redirect) {
		magicLinkUrl.searchParams.set("redirect", redirect)
	}

	const magicLink = magicLinkUrl.toString()
	const nitroApp = useNitroApp() as ReturnType<typeof useNitroApp> & { queue?: Queue }

	if (nitroApp.queue) {
		await nitroApp.queue.sendAuthLinkEmail(email, magicLink, appName, ttlMinutes)
	}
	else {
		await sendMail({
			to: email,
			subject: `Sign in to ${appName}`,
			text: `Open this sign-in link: ${magicLink}`,
		})
	}

	await auditNonCustomerAction(event, toSessionUser(user), {
		action: "auth.magic_link_requested",
		targetType: "user",
		targetId: String(user.id),
		summary: `${user.email} requested a magic link`,
		metadata: {
			redirect: redirect ?? null,
		},
	})

	return {
		success: true,
		message: "If an account exists for this email, a magic link will arrive shortly.",
		expires_in: ttlMinutes * 60,
	}
})
