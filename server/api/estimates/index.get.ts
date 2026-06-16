import type { OEOrderListResponseT } from "#shared/sage300"
import { oeOrdersGet } from "#shared/sage300"
import { listQuerySchema } from "#shared/schemas/list"
import type { EstimateSummary } from "#shared/types/estimate"
import type { PaginatedList } from "#shared/types/list"
import { authRepo } from "~~/server/db/repository"
import { requireSessionUser } from "~~/server/utils/auth"
import { escapeODataString, odataCount, sagePath, toEstimateSummary } from "~~/server/utils/sage300"

export default defineEventHandler(async (event): Promise<PaginatedList<EstimateSummary>> => {
	const sessionUser = await requireSessionUser(event)
	const { page, pageSize, search } = await getValidatedQuery(event, listQuerySchema.parse)
	const user = await authRepo.findUserById(sessionUser.id)

	// Admins see every quote; customers are scoped to their linked Sage account.
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

	const searchFilter = search
		? ` and (contains(OrderNumber,'${escapeODataString(search)}') or contains(OrderReference,'${escapeODataString(search)}'))`
		: ""

	const response = await oeOrdersGet({
		path: sagePath(),
		query: {
			$filter: `OrderType eq 'Quote'${customerFilter}${searchFilter}`,
			$skip: (page - 1) * pageSize,
			$top: pageSize,
			$count: true,
		},
	})
	const data = response.data as OEOrderListResponseT

	return {
		rows: (data.value ?? []).map(toEstimateSummary),
		total: odataCount(response.data),
		page,
		pageSize,
	}
})
