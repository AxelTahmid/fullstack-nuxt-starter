import type { DashboardStats } from "#shared/types/dashboard"
import { requireSessionUser } from "~~/server/utils/auth"

export default defineEventHandler(async (event): Promise<DashboardStats> => {
	await requireSessionUser(event)

	return {
		kpis: {
			activeOrders: 0,
			pendingRfps: 0,
			openEnquiries: 0,
			estimatesInReview: 0,
			projectedExpenditureCents: 0,
			supplyChainHealthPct: 100,
		},
		criticalActions: [],
		recentActivity: [],
	}
})
