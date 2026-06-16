export type OrderStatus = "placed" | "processing" | "shipped" | "delivered"

export interface OrderLine {
	id: number
	sourceKey: string
	sku: string
	name: string
	unitPriceCents: number
	quantity: number
	lineTotalCents: number
}

export interface OrderDetail {
	id: number
	orderNumber: string
	status: OrderStatus
	subtotalCents: number
	shippingCents: number
	taxCents: number
	totalCents: number
	paymentMethod: string
	poNumber: string | null
	deliverySite: string
	carrier: string
	placedAt: string
	lines: OrderLine[]
}

export interface OrderSummary {
	id: number
	orderNumber: string
	status: OrderStatus
	totalCents: number
	placedAt: string
	itemCount: number
}

export interface CheckoutPayload {
	deliverySite: string
	carrier: string
	deliveryContact?: string
	requestedShipDate?: string
	shippingInstructions?: string
	paymentMethod: string
	poNumber?: string
}

export interface CheckoutResponse {
	orderNumber: string
}
