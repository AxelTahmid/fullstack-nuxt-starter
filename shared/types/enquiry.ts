export type EnquiryStatus = "sent" | "received" | "reviewing" | "responded" | "resolved"
export type EnquiryPriority = "low" | "medium" | "high" | "urgent"

/** Which party authored a message. Customers buy; admins answer as support. */
export type MessageSenderSide = "customer" | "support"

export interface EnquirySummary {
	id: number
	enquiryNumber: string
	subject: string
	productSku: string | null
	supplierName: string
	status: EnquiryStatus
	priority: EnquiryPriority
	updatedAt: string
	lastMessagePreview: string
	/** Messages from the other side the requesting viewer has not read yet. */
	unreadCount: number
}

export interface EnquiryMessage {
	id: number
	authorName: string
	authorRole: string
	senderSide: MessageSenderSide
	body: string
	attachmentName: string | null
	createdAt: string
}

export interface EnquiryThread {
	id: number
	enquiryNumber: string
	subject: string
	productSku: string | null
	supplierName: string
	status: EnquiryStatus
	priority: EnquiryPriority
	createdAt: string
	/** The customer who raised the enquiry (shown to admins triaging). */
	customerName: string | null
	customerEmail: string
	messages: EnquiryMessage[]
	/** Side the requesting user participates as. */
	viewerSide: MessageSenderSide
	customerLastReadMessageId: number | null
	supportLastReadMessageId: number | null
}

export interface EnquiryCreateResponse {
	enquiryNumber: string
}

export interface EnquiryReadResponse {
	side: MessageSenderSide
	lastReadMessageId: number | null
}

/**
 * Events pushed to clients over the SSE stream (`GET /api/enquiries/stream`).
 * Keyed by `enquiryNumber` so the client can route to the open thread or update
 * list/badge state for threads it is not currently viewing.
 */
export type EnquiryRealtimeEvent
	= | { type: "message", enquiryNumber: string, subject: string, message: EnquiryMessage }
		| { type: "status", enquiryNumber: string, status: EnquiryStatus, priority: EnquiryPriority }
		| { type: "read", enquiryNumber: string, side: MessageSenderSide, lastReadMessageId: number }
