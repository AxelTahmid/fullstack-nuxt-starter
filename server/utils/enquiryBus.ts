import type { EnquiryRealtimeEvent } from "#shared/types/enquiry"

/**
 * In-process pub/sub for enquiry realtime events.
 *
 * SINGLE-INSTANCE ONLY: events are dispatched within this Node process. Running more
 * than one Nitro instance behind a load balancer would drop cross-instance events.
 * To scale out, swap the emit/subscribe internals here for Postgres LISTEN/NOTIFY
 * (or Redis pub/sub) without changing any call sites.
 */

type Handler = (payload: EnquiryRealtimeEvent) => void

const ADMIN_CHANNEL = "admins"
const userChannel = (userId: number) => `user:${userId}`

const channels = new Map<string, Set<Handler>>()

export type EnquiryChannel
	= | { kind: "user", userId: number }
		| { kind: "admins" }

/** The channel a connecting session should listen on. */
export function channelFor(role: string, userId: number): EnquiryChannel {
	return role === "admin" ? { kind: "admins" } : { kind: "user", userId }
}

function channelKey(channel: EnquiryChannel): string {
	return channel.kind === "admins" ? ADMIN_CHANNEL : userChannel(channel.userId)
}

function emit(key: string, payload: EnquiryRealtimeEvent) {
	channels.get(key)?.forEach(handler => handler(payload))
}

/** Publish an event to the enquiry owner and every connected admin. */
export function publishEnquiryEvent(ownerUserId: number, payload: EnquiryRealtimeEvent) {
	emit(userChannel(ownerUserId), payload)
	emit(ADMIN_CHANNEL, payload)
}

/** Subscribe a handler to a channel; returns an unsubscribe function. */
export function subscribeEnquiry(channel: EnquiryChannel, handler: Handler): () => void {
	const key = channelKey(channel)
	let handlers = channels.get(key)
	if (!handlers) {
		handlers = new Set()
		channels.set(key, handlers)
	}
	handlers.add(handler)

	return () => {
		const current = channels.get(key)
		if (!current) {
			return
		}
		current.delete(handler)
		if (current.size === 0) {
			channels.delete(key)
		}
	}
}

/** Whether anyone is currently listening on a channel (gates offline-only emails). */
export function hasSubscribers(channel: EnquiryChannel): boolean {
	const handlers = channels.get(channelKey(channel))
	return handlers !== undefined && handlers.size > 0
}
