import type { OEOrderListResponseT } from "#shared/sage300"
import { oeOrdersGet } from "#shared/sage300"
import type { EstimateDetail } from "#shared/types/estimate"
import { authRepo } from "~~/server/db/repository"
import { requireSessionUser } from "~~/server/utils/auth"
import { escapeODataString, sagePath, toEstimateDetail } from "~~/server/utils/sage300"

export default defineEventHandler(async (event): Promise<EstimateDetail> => {
	const sessionUser = await requireSessionUser(event)
	const number = getRouterParam(event, "number")?.trim()

	if (!number) {
		throw createError({
			statusCode: 400,
			statusMessage: "Estimate number is required",
		})
	}

	const user = await authRepo.findUserById(sessionUser.id)
	const quoteFilter = `(OrderNumber eq '${escapeODataString(number)}' or OrderReference eq '${escapeODataString(number)}') and OrderType eq 'Quote'`
	const customerFilter = sessionUser.role === "admin"
		? ""
		: user?.sage_customer_number
			? ` and CustomerNumber eq '${escapeODataString(user.sage_customer_number)}'`
			: null

	if (customerFilter === null) {
		throw createError({
			statusCode: 400,
			statusMessage: "Customer account is not linked",
		})
	}

	const response = await oeOrdersGet({
		path: sagePath(),
		query: {
			$filter: `${quoteFilter}${customerFilter}`,
			$top: 1,
		},
	})
	const data = response.data as OEOrderListResponseT
	const order = data.value?.[0]

	if (!order) {
		throw createError({
			statusCode: 404,
			statusMessage: "Estimate not found",
		})
	}

	return toEstimateDetail(order)
})
