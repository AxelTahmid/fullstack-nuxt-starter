import type { EnquiryRealtimeEvent, EnquirySummary, MessageSenderSide } from "#shared/types/enquiry"

type EnquiryEventListener = (event: EnquiryRealtimeEvent) => void

// Module-level registry shared by every consumer on the client. The client plugin
// (`plugins/enquiryStream.client.ts`) owns the EventSource and calls dispatch.
const listeners = new Set<EnquiryEventListener>()

/** Fan an incoming SSE event out to all registered page listeners. */
export function dispatchEnquiryEvent(event: EnquiryRealtimeEvent) {
	listeners.forEach(listener => listener(event))
}

/**
 * Reactive accessors for enquiry realtime state plus per-page event subscription.
 * Global unread state is shared via `useState`, so the sidebar badge, list page,
 * and thread page all stay in sync.
 */
export function useEnquiryStream() {
	const { user } = useUserSession()
	const unreadMap = useState<Record<string, number>>("enquiry-unread", () => ({}))
	const activeEnquiry = useState<string | null>("enquiry-active-number", () => null)
	const connected = useState<boolean>("enquiry-stream-connected", () => false)

	const viewerSide = computed<MessageSenderSide>(() => user.value?.role === "admin" ? "support" : "customer")
	const totalUnread = computed(() => Object.values(unreadMap.value).reduce((sum, count) => sum + count, 0))

	function setUnreadFromSummaries(summaries: EnquirySummary[]) {
		unreadMap.value = Object.fromEntries(summaries.map(summary => [summary.enquiryNumber, summary.unreadCount]))
	}

	function setUnread(enquiryNumber: string, count: number) {
		unreadMap.value = { ...unreadMap.value, [enquiryNumber]: Math.max(0, count) }
	}

	function clearUnread(enquiryNumber: string) {
		if (unreadMap.value[enquiryNumber]) {
			setUnread(enquiryNumber, 0)
		}
	}

	function setActiveEnquiry(enquiryNumber: string | null) {
		activeEnquiry.value = enquiryNumber
	}

	/** Subscribe to realtime events for the lifetime of the calling scope. */
	function onEnquiryEvent(listener: EnquiryEventListener) {
		listeners.add(listener)
		onScopeDispose(() => {
			listeners.delete(listener)
		})
	}

	return {
		viewerSide,
		unreadMap,
		totalUnread,
		connected,
		setUnreadFromSummaries,
		setUnread,
		clearUnread,
		setActiveEnquiry,
		onEnquiryEvent,
	}
}
