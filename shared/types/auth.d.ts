import type { UserRole } from "./user"

declare module "#auth-utils" {
	interface User {
		id: number
		email: string
		name: string | null
		role: UserRole
		email_verified: boolean
		password_reset_required: boolean
		last_active_at: Date | null
		created_at: Date
	}

	interface UserSession {
		user: User
	}
}

export {}
