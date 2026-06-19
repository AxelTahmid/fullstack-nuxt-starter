import type { EnquiryPriority, EnquiryStatus, EnquirySummary } from "#shared/types/enquiry"
import { enquiryRepo } from "~~/server/db/repository"
import { requireSessionUser } from "~~/server/utils/auth"

export default defineEventHandler(async (event): Promise<EnquirySummary[]> => {
	const sessionUser = await requireSessionUser(event)
	const isAdmin = sessionUser.role === "admin"
	const rows = await enquiryRepo.listSummaries({
		userId: isAdmin ? undefined : sessionUser.id,
		viewerSide: isAdmin ? "support" : "customer",
	})

	return rows.map((row): EnquirySummary => ({
		id: row.id,
		enquiryNumber: row.enquiry_number,
		subject: row.subject,
		productSku: row.product_sku,
		supplierName: row.supplier_name,
		status: row.status as EnquiryStatus,
		priority: row.priority as EnquiryPriority,
		updatedAt: new Date(row.updated_at).toISOString(),
		lastMessagePreview: row.last_message_preview ?? "",
		unreadCount: Number(row.unread_count ?? 0),
	}))
})
