import type { AuditLogEntry, UserListRow, UserRole } from "#shared/types/user"

type UserRecord = {
	id: number
	email: string
	name: string | null
	role: string
	email_verified: boolean
	deactivated: boolean
	password_reset_required: boolean
	sage_customer_number: string | null
	sage_customer_name: string | null
	last_active_at: Date | string | null
	created_at: Date | string
	updated_at: Date | string | null
}

type AuditLogRecord = {
	id: string
	actor_user_id: number | null
	actor_email: string | null
	action: string
	target_type: string
	target_id: string | null
	summary: string
	metadata: unknown
	ip_address: string | null
	user_agent: string | null
	created_at: Date | string
}

function iso(value: Date | string | null) {
	if (!value) {
		return null
	}

	return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function role(value: string): UserRole {
	return value === "admin" ? "admin" : "customer"
}

export function toUserListRow(user: UserRecord): UserListRow {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		role: role(user.role),
		emailVerified: user.email_verified,
		deactivated: user.deactivated,
		passwordResetRequired: user.password_reset_required,
		sageCustomerNumber: user.sage_customer_number,
		sageCustomerName: user.sage_customer_name,
		lastActiveAt: iso(user.last_active_at),
		createdAt: iso(user.created_at) ?? new Date().toISOString(),
		updatedAt: iso(user.updated_at),
	}
}

export function toAuditLogEntry(row: AuditLogRecord): AuditLogEntry {
	return {
		id: row.id,
		actorUserId: row.actor_user_id,
		actorEmail: row.actor_email,
		action: row.action,
		targetType: row.target_type,
		targetId: row.target_id,
		summary: row.summary,
		metadata: row.metadata,
		ipAddress: row.ip_address,
		userAgent: row.user_agent,
		createdAt: iso(row.created_at) ?? new Date().toISOString(),
	}
}
