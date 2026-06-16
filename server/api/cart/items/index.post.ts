import type { ICItemListResponseT, ICItemT } from "#shared/sage300"
import { icItemsGetByUnformattedItemNumber } from "#shared/sage300"
import { cartItemAddSchema } from "#shared/schemas/checkout"
import { cartRepo } from "~~/server/db/repository"
import { requireSessionUser } from "~~/server/utils/auth"

function sagePath() {
	const { sage300 } = useRuntimeConfig()

	return {
		apiVersion: String(sage300.apiVersion),
		tenant: String(sage300.tenant),
		company: String(sage300.company),
	}
}

function firstItem(data: ICItemListResponseT | ICItemT | undefined): ICItemT | undefined {
	if (!data) {
		return undefined
	}

	if ("value" in data) {
		return data.value?.[0]
	}

	return data as ICItemT
}

async function requireItem(sourceKey: string) {
	const response = await icItemsGetByUnformattedItemNumber({
		path: {
			...sagePath(),
			UnformattedItemNumber: sourceKey,
		},
	})
	const item = firstItem(response.data)

	if (!item || !(item.UnformattedItemNumber || item.ItemNumber)) {
		throw createError({
			statusCode: 404,
			statusMessage: "Product not found",
		})
	}
}

export default defineEventHandler(async (event) => {
	const user = await requireSessionUser(event)
	const body = await readValidatedBody(event, cartItemAddSchema.parse)

	await requireItem(body.sourceKey)
	const item = await cartRepo.upsertItem(user.id, body.sourceKey, body.quantity)

	return { item }
})
