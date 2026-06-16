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

	const item = await cartRepo.deleteItem(user.id, itemId)
	if (!item) {
		throw createError({
			statusCode: 404,
			statusMessage: "Cart item not found",
		})
	}

	return { item }
})
