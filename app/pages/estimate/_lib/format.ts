export function formatPrice(cents: number) {
	return new Intl.NumberFormat("en-CA", {
		style: "currency",
		currency: "CAD",
	}).format(cents / 100)
}

export function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	})
}
