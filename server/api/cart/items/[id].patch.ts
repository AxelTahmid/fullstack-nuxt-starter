import { cartItemUpdateSchema } from "#shared/schemas/checkout"
import { cartRepo } from "~~/server/db/repository"
import { auditNonCustomerAction } from "~~/server/utils/audit"
import { requireCustomer } from "~~/server/utils/auth"

export default defineEventHandler(async (event) => {
	const user = await requireCustomer(event)
	const rawId = getRouterParam(event, "id")
	const itemId = rawId ? Number.parseInt(rawId, 10) : Number.NaN
	if (!Number.isFinite(itemId)) {
		throw createError({
			statusCode: 400,
			statusMessage: "Cart item id is required",
		})
	}

	const body = await readValidatedBody(event, cartItemUpdateSchema.parse)
	const item = await cartRepo.updateQuantity(user.id, itemId, body.quantity)
	if (!item) {
		throw createError({
			statusCode: 404,
			statusMessage: "Cart item not found",
		})
	}

	await auditNonCustomerAction(event, user, {
		action: body.quantity === 0 ? "cart.item_remove" : "cart.item_update",
		targetType: "cart_item",
		targetId: String(item.id),
		summary: body.quantity === 0
			? `${user.email} removed ${item.source_key} from cart`
			: `${user.email} updated ${item.source_key} cart quantity`,
		metadata: {
			sourceKey: item.source_key,
			quantity: body.quantity,
		},
	})

	return { item }
})
