import type { AuditLogEntry } from "#shared/types/user"
import { auditRepo } from "~~/server/db/repository"
import { requireAdmin } from "~~/server/utils/auth"
import { toAuditLogEntry } from "~~/server/utils/user-dto"

export default defineEventHandler(async (event): Promise<{ audit: AuditLogEntry[] }> => {
	await requireAdmin(event)
	const query = getQuery(event)
	const limit = Math.min(Math.max(Number.parseInt(String(query.limit || "100"), 10) || 100, 1), 250)
	const rows = await auditRepo.list(limit)

	return {
		audit: rows.map(toAuditLogEntry),
	}
})
