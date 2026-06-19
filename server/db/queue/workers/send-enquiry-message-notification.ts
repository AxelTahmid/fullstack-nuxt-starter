import type { Job } from "pg-boss"
import { sendMail } from "~~/server/utils/mailer"
import { log } from "~~/shared/log"

export interface SendEnquiryMessageNotificationJobData {
	email: string
	recipientName: string | null
	appName: string
	enquiryNumber: string
	subject: string
	senderName: string
	senderSide: "customer" | "support"
	preview: string
	link: string
}

function subjectLine(data: SendEnquiryMessageNotificationJobData) {
	return `New message on ${data.enquiryNumber} · ${data.subject}`
}

function emailTemplate(data: SendEnquiryMessageNotificationJobData) {
	const greeting = data.recipientName ? `Hello ${data.recipientName},` : "Hello,"
	const fromLabel = data.senderSide === "support" ? "the SupplyKey team" : "the customer"

	return `
		<!DOCTYPE html>
		<html>
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>${subjectLine(data)}</title>
			</head>
			<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 24px; background: #f6f3ec;">
				<div style="max-width: 640px; margin: 0 auto; background: #fffaf2; border-radius: 18px; overflow: hidden; border: 1px solid #eadfce;">
					<div style="padding: 32px; background: #1f2937; color: white;">
						<h1 style="margin: 0; font-size: 22px;">${data.appName}</h1>
					</div>
					<div style="padding: 32px;">
						<p>${greeting}</p>
						<p>You have a new message from ${fromLabel} on enquiry <strong>${data.enquiryNumber}</strong> (${data.subject}).</p>
						<p style="margin: 24px 0; padding: 16px; background: #f3f4f6; border-radius: 10px;">
							<strong>${data.senderName}:</strong> ${data.preview}
						</p>
						<p style="margin: 28px 0;">
							<a href="${data.link}" style="display: inline-block; padding: 14px 20px; border-radius: 12px; background: #c98d34; color: white; text-decoration: none; font-weight: 600;">
								Open enquiry
							</a>
						</p>
						<p>If the button does not work, use this URL:</p>
						<p style="word-break: break-word;">${data.link}</p>
					</div>
				</div>
			</body>
		</html>
	`
}

export const createSendEnquiryMessageNotificationHandler = () => {
	return async ([job]: Job<SendEnquiryMessageNotificationJobData>[]) => {
		if (!job) {
			throw new Error("Missing queued job payload")
		}

		const data = job.data
		if (!data.email || !data.enquiryNumber || !data.link) {
			throw new Error(`Missing required enquiry notification fields for job ${job.id}`)
		}

		await sendMail({
			to: data.email,
			subject: subjectLine(data),
			text: `${data.senderName} sent a message on ${data.enquiryNumber} (${data.subject}):\n\n${data.preview}\n\nOpen the enquiry: ${data.link}`,
			html: emailTemplate(data),
		})

		log.info({ email: data.email, enquiryNumber: data.enquiryNumber, jobId: job.id }, "Enquiry message notification sent")
	}
}
