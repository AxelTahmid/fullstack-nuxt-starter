import type { OrderLine } from "./order"

export type EstimateStatus = "submitted" | "expired" | "converted"

export interface EstimateSummary {
	id: number
	quoteNumber: string
	status: EstimateStatus
	totalCents: number
	itemCount: number
	expiresAt: string | null
	createdAt: string
}

export interface EstimateDetail {
	id: number
	quoteNumber: string
	status: EstimateStatus
	subtotalCents: number
	taxCents: number
	totalCents: number
	deliverySite: string
	comment: string | null
	expiresAt: string | null
	createdAt: string
	convertedOrderNumber: string | null
	lines: OrderLine[]
}

export interface EstimateResponse {
	quoteNumber: string
}
