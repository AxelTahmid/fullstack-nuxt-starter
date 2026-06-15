export interface CartLine {
	id: number
	sourceKey: string
	sku: string
	name: string
	category: string
	manufacturer: string
	imageUrl: string | null
	unitPriceCents: number
	quantity: number
	lineTotalCents: number
}

export interface CartSummary {
	lines: CartLine[]
	itemCount: number
	subtotalCents: number
	shippingCents: number
	taxCents: number
	totalCents: number
}
