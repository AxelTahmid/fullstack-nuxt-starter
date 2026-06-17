import type { AuditLogEntry } from "#shared/types/user"
import { auditRepo, userRepo } from "~~/server/db/repository"
import { requireAdmin } from "~~/server/utils/auth"
import { toAuditLogEntry } from "~~/server/utils/user-dto"

function parseId(value: string | undefined) {
	const id = Number.parseInt(value || "", 10)

	if (!Number.isInteger(id) || id <= 0) {
		throw createError({
			statusCode: 400,
			statusMessage: "Valid user id is required",
		})
	}

	return id
}

export default defineEventHandler(async (event): Promise<{ audit: AuditLogEntry[] }> => {
	await requireAdmin(event)
	const id = parseId(getRouterParam(event, "id"))
	const user = await userRepo.findUserById(id)

	if (!user) {
		throw createError({
			statusCode: 404,
			statusMessage: "User not found",
		})
	}

	const rows = await auditRepo.listForTarget("user", String(id))

	return {
		audit: rows.map(toAuditLogEntry),
	}
})
