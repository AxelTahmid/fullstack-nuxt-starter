import type { CartSummary } from "#shared/types/cart"

const emptySummary: CartSummary = {
	lines: [],
	itemCount: 0,
	subtotalCents: 0,
	shippingCents: 0,
	taxCents: 0,
	totalCents: 0,
}

export function useCart() {
	const summary = useState<CartSummary>("cart-summary", () => ({ ...emptySummary }))
	const isLoading = useState<boolean>("cart-summary-loading", () => false)

	async function refresh() {
		isLoading.value = true
		try {
			summary.value = await $fetch<CartSummary>("/api/cart")
		}
		catch {
			summary.value = { ...emptySummary }
		}
		finally {
			isLoading.value = false
		}
	}

	async function addItem(sourceKey: string, quantity = 1) {
		await $fetch("/api/cart/items", {
			method: "POST",
			body: { sourceKey, quantity },
		})
		await refresh()
	}

	async function updateQuantity(id: number, quantity: number) {
		await $fetch(`/api/cart/items/${id}`, {
			method: "PATCH",
			body: { quantity },
		})
		await refresh()
	}

	async function removeItem(id: number) {
		await $fetch(`/api/cart/items/${id}`, { method: "DELETE" })
		await refresh()
	}

	return {
		summary: readonly(summary),
		isLoading: readonly(isLoading),
		refresh,
		addItem,
		updateQuantity,
		removeItem,
	}
}
