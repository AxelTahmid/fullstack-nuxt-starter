import { log } from "#shared/log"
import { channelFor, subscribeEnquiry } from "~~/server/utils/enquiryBus"
import { requireSessionUser } from "~~/server/utils/auth"

/**
 * Server-Sent Events stream for enquiry realtime updates.
 *
 * One connection per browser tab. Customers receive events for their own
 * enquiries; admins receive events for all enquiries. Payloads are
 * `EnquiryRealtimeEvent` JSON; the client routes them by `enquiryNumber`.
 */
export default defineEventHandler(async (event) => {
	const sessionUser = await requireSessionUser(event)
	const channel = channelFor(sessionUser.role, sessionUser.id)

	// Disable proxy buffering so events flush immediately behind nginx/CDNs.
	setResponseHeader(event, "X-Accel-Buffering", "no")
	setResponseHeader(event, "Cache-Control", "no-cache, no-transform")

	const eventStream = createEventStream(event)
	log.info({ userId: sessionUser.id, role: sessionUser.role, channel }, "SSE enquiry stream connected")

	const push = (payload: unknown) => {
		// eslint-disable-next-line harlanzw/no-silent-catch -- client disconnected mid-write; onClosed performs teardown
		eventStream.push(JSON.stringify(payload)).catch(() => {})
	}

	const unsubscribe = subscribeEnquiry(channel, payload => push(payload))

	// Heartbeat prevents idle intermediaries from dropping the connection.
	const heartbeat = setInterval(() => push({ type: "ping" }), 25_000)

	eventStream.onClosed(async () => {
		clearInterval(heartbeat)
		unsubscribe()
		log.info({ userId: sessionUser.id, role: sessionUser.role }, "SSE enquiry stream closed")
		await eventStream.close()
	})

	return eventStream.send()
})
