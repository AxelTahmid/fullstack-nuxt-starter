import { cartItemUpdateSchema } from "#shared/schemas/checkout"
import { cartRepo } from "~~/server/db/repository"
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

	const body = await readValidatedBody(event, cartItemUpdateSchema.parse)
	const item = await cartRepo.updateQuantity(user.id, itemId, body.quantity)
	if (!item) {
		throw createError({
			statusCode: 404,
			statusMessage: "Cart item not found",
		})
	}

	return { item }
})
