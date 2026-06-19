import type { DashboardStats } from "#shared/types/dashboard"
import { enquiryRepo } from "~~/server/db/repository"
import { requireSessionUser } from "~~/server/utils/auth"

export default defineEventHandler(async (event): Promise<DashboardStats> => {
	const user = await requireSessionUser(event)
	const isAdmin = user.role === "admin"

	const openEnquiries = await enquiryRepo.countOpen(isAdmin ? undefined : user.id)

	return {
		kpis: {
			activeOrders: 0,
			pendingRfps: 0,
			openEnquiries,
			estimatesInReview: 0,
			projectedExpenditureCents: 0,
			supplyChainHealthPct: 100,
		},
		criticalActions: isAdmin
			? []
			: [{
					id: "customer-review-cart",
					priority: "low",
					title: "Review active cart",
					detail: "Keep your cart current before requesting an estimate or submitting an order.",
					dueLabel: "When ready",
					linkTo: "/cart",
				}],
		recentActivity: [],
	}
})
