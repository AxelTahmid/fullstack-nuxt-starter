export type OrderStatus = "placed" | "processing" | "shipped" | "delivered"

export interface OrderLine {
	id: number
	sourceKey: string
	sku: string
	name: string
	unitPriceCents: number
	quantity: number
	lineTotalCents: number
	/** Admin / Sage cross-reference fields. */
	quantityShipped: number
	quantityBackordered: number
	priceList: string | null
}

export interface OrderDetail {
	id: number
	orderNumber: string
	customerName: string
	customerNumber: string
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
	/** Admin / Sage cross-reference fields. */
	orderType: string
	reference: string | null
	expectedShipDate: string | null
	lines: OrderLine[]
}

export interface OrderSummary {
	id: number
	orderNumber: string
	poNumber: string | null
	customerName: string
	customerNumber: string
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
