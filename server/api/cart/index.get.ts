import type { CartLine, CartSummary } from "#shared/types/cart"
import { requireSessionUser } from "~~/server/utils/auth"

function buildSummary(lines: CartLine[]): CartSummary {
	const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0)
	const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0)
	const shippingCents = 0
	const taxCents = 0
	const totalCents = subtotalCents + shippingCents + taxCents

	return {
		lines,
		itemCount,
		subtotalCents,
		shippingCents,
		taxCents,
		totalCents,
	}
}

export default defineEventHandler(async (event): Promise<CartSummary> => {
	await requireSessionUser(event)

	return buildSummary([])
})
