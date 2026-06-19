import type { EnquiryRealtimeEvent, EnquirySummary, MessageSenderSide } from "#shared/types/enquiry"
import { toast } from "~/components/toast"
import { dispatchEnquiryEvent } from "~/composables/useEnquiryStream"

/**
 * Owns the single browser EventSource for enquiry realtime updates. Connects when
 * a session is present and reconnects (natively) on transient errors. Applies the
 * global side effects — unread badge bump and cross-page toast — then fans the
 * event out to any page-level listeners.
 */
export default defineNuxtPlugin(() => {
	const { loggedIn, user } = useUserSession()
	const unreadMap = useState<Record<string, number>>("enquiry-unread", () => ({}))
	const activeEnquiry = useState<string | null>("enquiry-active-number", () => null)
	const connected = useState<boolean>("enquiry-stream-connected", () => false)

	let source: EventSource | null = null

	function viewerSide(): MessageSenderSide {
		return user.value?.role === "admin" ? "support" : "customer"
	}

	function handle(event: EnquiryRealtimeEvent) {
		if (event.type === "message") {
			const inbound = event.message.senderSide !== viewerSide()
			// Bump the badge + toast only when the user is not already reading the thread.
			if (inbound && activeEnquiry.value !== event.enquiryNumber) {
				unreadMap.value = {
					...unreadMap.value,
					[event.enquiryNumber]: (unreadMap.value[event.enquiryNumber] ?? 0) + 1,
				}
				toast.info(`New message · ${event.subject}`)
			}
		}

		dispatchEnquiryEvent(event)
	}

	async function seedUnread() {
		try {
			const summaries = await $fetch<EnquirySummary[]>("/api/enquiries")
			unreadMap.value = Object.fromEntries(summaries.map(summary => [summary.enquiryNumber, summary.unreadCount]))
		}
		catch {
			// Non-fatal: badges simply stay at their current values.
		}
	}

	function connect() {
		if (source) {
			return
		}

		source = new EventSource("/api/enquiries/stream")
		source.onopen = () => {
			connected.value = true
		}
		source.onerror = () => {
			// EventSource reconnects automatically; just reflect the dropped state.
			connected.value = false
		}
		source.onmessage = (messageEvent) => {
			let data: unknown
			try {
				data = JSON.parse(messageEvent.data)
			}
			catch {
				return
			}

			if (!data || typeof data !== "object" || !("type" in data)) {
				return
			}

			if ((data as { type: string }).type === "ping") {
				return
			}

			handle(data as EnquiryRealtimeEvent)
		}

		void seedUnread()
	}

	function disconnect() {
		source?.close()
		source = null
		connected.value = false
		unreadMap.value = {}
	}

	watch(loggedIn, (value) => {
		if (value) {
			connect()
		}
		else {
			disconnect()
		}
	}, { immediate: true })
})
