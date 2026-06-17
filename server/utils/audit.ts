import type { H3Event } from "h3"
import type { JsonValue } from "~~/server/db/types"
import { auditRepo } from "~~/server/db/repository"
import type { SessionUser } from "~~/server/utils/auth"

export interface AuditActionInput {
	action: string
	targetType: string
	targetId?: string | null
	summary: string
	metadata?: JsonValue
}

export async function auditNonCustomerAction(event: H3Event, actor: SessionUser, input: AuditActionInput) {
	if (actor.role === "customer") {
		return
	}

	await auditRepo.create({
		actorUserId: actor.id,
		action: input.action,
		targetType: input.targetType,
		targetId: input.targetId,
		summary: input.summary,
		metadata: input.metadata ?? {},
		ipAddress: getRequestIP(event) ?? null,
		userAgent: getRequestHeader(event, "user-agent") ?? null,
	})
}
