import { cartRepo } from "~~/server/db/repository"
import { auditNonCustomerAction } from "~~/server/utils/audit"
import { requireSessionUser } from "~~/server/utils/auth"

export default defineEventHandler(async (event) => {
	const user = await requireSessionUser(event)
	const rawId = getRouterParam(event, "id")
	const itemId = rawId ? Number.parseInt(rawId, 10) : Number.NaN
	if (!Number.isFinite(itemId)) {
		throw createError({
			statusCode: 400,
			statusMessage: "Cart item id is required",
		})
	}

	const item = await cartRepo.deleteItem(user.id, itemId)
	if (!item) {
		throw createError({
			statusCode: 404,
			statusMessage: "Cart item not found",
		})
	}

	await auditNonCustomerAction(event, user, {
		action: "cart.item_remove",
		targetType: "cart_item",
		targetId: String(item.id),
		summary: `${user.email} removed ${item.source_key} from cart`,
		metadata: {
			sourceKey: item.source_key,
			quantity: item.quantity,
		},
	})

	return { item }
})
