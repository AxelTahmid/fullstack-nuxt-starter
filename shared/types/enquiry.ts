export type EnquiryStatus = "sent" | "received" | "reviewing" | "responded" | "resolved"
export type EnquiryPriority = "low" | "medium" | "high" | "urgent"

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
}

export interface EnquiryMessage {
	id: number
	authorName: string
	authorRole: string
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
	messages: EnquiryMessage[]
}

export interface EnquiryCreateResponse {
	enquiryNumber: string
}
