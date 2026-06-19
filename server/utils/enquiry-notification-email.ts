import type { MessageSenderSide } from "#shared/types/enquiry"
import type { Queue } from "~~/server/db/queue"
import { hasSubscribers, type EnquiryChannel } from "~~/server/utils/enquiryBus"
import { sendMail } from "~~/server/utils/mailer"

interface NotificationRecipient {
	email: string
	name: string | null
}

interface NotifyEnquiryMessageInput {
	enquiryNumber: string
	subject: string
	senderName: string
	senderSide: MessageSenderSide
	preview: string
	recipients: NotificationRecipient[]
	/** Channel the recipient side listens on; skip email if it has live subscribers. */
	recipientChannel: EnquiryChannel
}

/**
 * Notify the recipient side of a new enquiry message. Presence-gated: if the
 * recipient side has a live SSE connection, the in-app realtime update is enough
 * and no email is queued. Falls back to inline send if the queue is unavailable.
 */
export async function notifyEnquiryMessage(input: NotifyEnquiryMessageInput) {
	if (!input.recipients.length) {
		return
	}

	if (hasSubscribers(input.recipientChannel)) {
		return
	}

	const runtimeConfig = useRuntimeConfig()
	const appName = runtimeConfig.public.appName
	const baseURL = runtimeConfig.public.baseURL.replace(/\/$/, "")
	const link = `${baseURL}/enquiries/${input.enquiryNumber}`
	const preview = input.preview.length > 280 ? `${input.preview.slice(0, 277)}…` : input.preview
	const nitroApp = useNitroApp() as ReturnType<typeof useNitroApp> & { queue?: Queue }

	await Promise.all(input.recipients.map(async (recipient) => {
		if (nitroApp.queue) {
			await nitroApp.queue.sendEnquiryMessageNotification({
				email: recipient.email,
				recipientName: recipient.name,
				appName,
				enquiryNumber: input.enquiryNumber,
				subject: input.subject,
				senderName: input.senderName,
				senderSide: input.senderSide,
				preview,
				link,
			})
			return
		}

		await sendMail({
			to: recipient.email,
			subject: `New message on ${input.enquiryNumber} · ${input.subject}`,
			text: `${input.senderName} sent a message on ${input.enquiryNumber}:\n\n${preview}\n\nOpen the enquiry: ${link}`,
		})
	}))
}
