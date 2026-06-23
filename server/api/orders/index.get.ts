import type { OEOrderListResponseT } from "#shared/sage300"
import { oeOrdersGet } from "#shared/sage300"
import { listQuerySchema } from "#shared/schemas/list"
import type { PaginatedList } from "#shared/types/list"
import type { OrderSummary } from "#shared/types/order"
import { authRepo } from "~~/server/db/repository"
import { requireSessionUser } from "~~/server/utils/auth"
import { escapeODataString, odataCount, sagePath, toOrderSummary } from "~~/server/utils/sage300"

export default defineEventHandler(async (event): Promise<PaginatedList<OrderSummary>> => {
	const sessionUser = await requireSessionUser(event)
	const { page, pageSize, search } = await getValidatedQuery(event, listQuerySchema.parse)
	const user = await authRepo.findUserById(sessionUser.id)

	// Admins see every order; customers are scoped to their linked Sage account.
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
		? ` and (contains(OrderNumber,'${escapeODataString(search)}') or contains(OrderReference,'${escapeODataString(search)}') or contains(PurchaseOrderNumber,'${escapeODataString(search)}'))`
		: ""

	// Pagination is pushed to Sage via OData $skip/$top; $count returns the total
	// (OData v4). Sage's OE list DOES honour $orderby (the generated SDK type omits
	// it, but the service accepts it), so newest-first ordering is pushed down too.
	const query = {
		$filter: `OrderType ne 'Quote'${customerFilter}${searchFilter}`,
		$orderby: "OrderDate desc, OrderNumber desc",
		$skip: (page - 1) * pageSize,
		$top: pageSize,
		$count: true,
	}
	const response = await oeOrdersGet({
		path: sagePath(),
		query,
	})
	const data = response.data as OEOrderListResponseT

	return {
		rows: (data.value ?? []).map(toOrderSummary),
		total: odataCount(response.data),
		page,
		pageSize,
	}
})
