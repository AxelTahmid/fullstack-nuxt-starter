import type { StockStatus } from "#shared/types/product"

export function formatCount(value: number) {
	return value.toLocaleString("en-US")
}

export function formatPrice(cents: number, currencyCode: string) {
	return new Intl.NumberFormat("en-CA", {
		style: "currency",
		currency: currencyCode,
	}).format(cents / 100)
}

export function stockLabel(status: StockStatus) {
	const labels: Record<StockStatus, string> = {
		in_stock: "In stock",
		low_stock: "Low stock",
		out_of_stock: "Out of stock",
		made_to_order: "Made to order",
	}

	return labels[status]
}
