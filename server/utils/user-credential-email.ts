import type { Queue } from "~~/server/db/queue"
import { sendMail } from "~~/server/utils/mailer"

interface CredentialEmailInput {
	email: string
	name: string | null
	temporaryPassword: string
	reason: "welcome" | "reset"
	loginUrl: string
}

export async function sendUserCredentialEmail(input: CredentialEmailInput) {
	const runtimeConfig = useRuntimeConfig()
	const appName = runtimeConfig.public.appName
	const nitroApp = useNitroApp() as ReturnType<typeof useNitroApp> & { queue?: Queue }

	if (nitroApp.queue) {
		await nitroApp.queue.sendUserCredentialEmail({
			...input,
			appName,
		})
		return
	}

	await sendMail({
		to: input.email,
		subject: input.reason === "welcome" ? `Welcome to ${appName}` : `${appName} password reset`,
		text: `Sign in at ${input.loginUrl} using this temporary password: ${input.temporaryPassword}`,
	})
}
