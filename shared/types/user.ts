export type UserRole = "admin" | "customer"

export interface UserListRow {
	id: number
	email: string
	name: string | null
	role: UserRole
	emailVerified: boolean
	deactivated: boolean
	passwordResetRequired: boolean
	sageCustomerNumber: string | null
	sageCustomerName: string | null
	lastActiveAt: string | null
	createdAt: string
	updatedAt: string | null
}

export interface SageCustomerLookup {
	customerNumber: string
	customerName: string
	shortName: string | null
	status: string | null
	onHold: string | null
	accountSet: string | null
	priceList: string | null
	terms: string | null
	currencyCode: string | null
	creditLimit: number | null
	balanceDue: number | null
	contactName: string | null
	email: string | null
	phoneNumber: string | null
	address: string[]
}

export interface AuditLogEntry {
	id: number
	actorUserId: number | null
	actorEmail: string | null
	action: string
	targetType: string
	targetId: string | null
	summary: string
	metadata: unknown
	ipAddress: string | null
	userAgent: string | null
	createdAt: string
}
