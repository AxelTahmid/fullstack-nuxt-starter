import type { Insertable } from "kysely"
import { Database } from "../base"
import type { AuditLogs, JsonValue } from "../types"

export interface CreateAuditLogInput {
	actorUserId: number | null
	action: string
	targetType: string
	targetId?: string | null
	summary: string
	metadata?: JsonValue
	ipAddress?: string | null
	userAgent?: string | null
}

class AuditRepository extends Database {
	private static auditInstance: AuditRepository | null = null

	private constructor() {
		super(Database.getInstance().getQueryBuilder())
	}

	static override getInstance() {
		if (!AuditRepository.auditInstance) {
			AuditRepository.auditInstance = new AuditRepository()
		}

		return AuditRepository.auditInstance
	}

	async create(input: CreateAuditLogInput) {
		const values: Insertable<AuditLogs> = {
			actor_user_id: input.actorUserId,
			action: input.action,
			target_type: input.targetType,
			target_id: input.targetId ?? null,
			summary: input.summary,
			metadata: input.metadata ?? {},
			ip_address: input.ipAddress ?? null,
			user_agent: input.userAgent ?? null,
		}

		return this.db
			.insertInto("audit_logs")
			.values(values)
			.returningAll()
			.executeTakeFirstOrThrow()
	}

	async list(limit = 100) {
		return this.db
			.selectFrom("audit_logs as a")
			.leftJoin("users as actor", "actor.id", "a.actor_user_id")
			.select([
				"a.id",
				"a.actor_user_id",
				"actor.email as actor_email",
				"a.action",
				"a.target_type",
				"a.target_id",
				"a.summary",
				"a.metadata",
				"a.ip_address",
				"a.user_agent",
				"a.created_at",
			])
			.orderBy("a.created_at", "desc")
			.limit(limit)
			.execute()
	}

	async listForTarget(targetType: string, targetId: string, limit = 100) {
		return this.db
			.selectFrom("audit_logs as a")
			.leftJoin("users as actor", "actor.id", "a.actor_user_id")
			.select([
				"a.id",
				"a.actor_user_id",
				"actor.email as actor_email",
				"a.action",
				"a.target_type",
				"a.target_id",
				"a.summary",
				"a.metadata",
				"a.ip_address",
				"a.user_agent",
				"a.created_at",
			])
			.where("a.target_type", "=", targetType)
			.where("a.target_id", "=", targetId)
			.orderBy("a.created_at", "desc")
			.limit(limit)
			.execute()
	}
}

export const auditRepo = AuditRepository.getInstance()
