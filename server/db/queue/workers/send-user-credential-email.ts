import type { Job } from "pg-boss"
import { sendMail } from "~~/server/utils/mailer"
import { log } from "~~/shared/log"

export interface SendUserCredentialEmailJobData {
	email: string
	name: string | null
	temporaryPassword: string
	appName: string
	reason: "welcome" | "reset"
	loginUrl: string
}

function subject(reason: SendUserCredentialEmailJobData["reason"], appName: string) {
	return reason === "welcome"
		? `Welcome to ${appName}`
		: `${appName} password reset`
}

function emailTemplate(data: SendUserCredentialEmailJobData) {
	const greeting = data.name ? `Hello ${data.name},` : "Hello,"
	const intro = data.reason === "welcome"
		? `An account has been created for you in ${data.appName}.`
		: `Your ${data.appName} password has been reset.`

	return `
		<!DOCTYPE html>
		<html>
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>${subject(data.reason, data.appName)}</title>
			</head>
			<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 24px; background: #f6f3ec;">
				<div style="max-width: 640px; margin: 0 auto; background: #fffaf2; border-radius: 18px; overflow: hidden; border: 1px solid #eadfce;">
					<div style="padding: 32px; background: #1f2937; color: white;">
						<h1 style="margin: 0; font-size: 28px;">${data.appName}</h1>
					</div>
					<div style="padding: 32px;">
						<p>${greeting}</p>
						<p>${intro}</p>
						<p>Use this temporary password to sign in:</p>
						<p style="margin: 24px 0; padding: 16px; background: #f3f4f6; border-radius: 10px; font-size: 20px; font-weight: 700; letter-spacing: 0.08em;">${data.temporaryPassword}</p>
						<p>You will be asked to set a new password before continuing.</p>
						<p style="margin: 28px 0;">
							<a href="${data.loginUrl}" style="display: inline-block; padding: 14px 20px; border-radius: 12px; background: #1f2937; color: white; text-decoration: none; font-weight: 600;">
								Sign in
							</a>
						</p>
						<p>If the button does not work, use this URL:</p>
						<p style="word-break: break-word;">${data.loginUrl}</p>
					</div>
				</div>
			</body>
		</html>
	`
}

export const createSendUserCredentialEmailHandler = () => {
	return async ([job]: Job<SendUserCredentialEmailJobData>[]) => {
		if (!job) {
			throw new Error("Missing queued job payload")
		}

		const data = job.data
		if (!data.email || !data.temporaryPassword || !data.loginUrl) {
			throw new Error(`Missing required credential email fields for job ${job.id}`)
		}

		await sendMail({
			to: data.email,
			subject: subject(data.reason, data.appName),
			text: `Sign in at ${data.loginUrl} using this temporary password: ${data.temporaryPassword}. You will be asked to set a new password before continuing.`,
			html: emailTemplate(data),
		})

		log.info({ email: data.email, reason: data.reason, jobId: job.id }, "User credential email sent")
	}
}
