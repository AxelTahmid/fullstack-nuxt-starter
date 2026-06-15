import { sql } from "kysely"
import { Database } from "../base"
import type { UserRole } from "../types"

class AuthRepository extends Database {
	private static authInstance: AuthRepository | null = null

	private constructor() {
		super(Database.getInstance().getQueryBuilder())
	}

	static override getInstance() {
		if (!AuthRepository.authInstance) {
			AuthRepository.authInstance = new AuthRepository()
		}

		return AuthRepository.authInstance
	}

	generateAuthToken() {
		const array = new Uint8Array(32)
		crypto.getRandomValues(array)
		return Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("")
	}

	async hashToken(token: string) {
		const encoder = new TextEncoder()
		const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(token))
		return Array.from(new Uint8Array(hashBuffer))
			.map(byte => byte.toString(16).padStart(2, "0"))
			.join("")
	}

	async findUserByEmail(email: string) {
		return this.db
			.selectFrom("users")
			.where(sql`lower(email)`, "=", email.toLowerCase())
			.selectAll()
			.executeTakeFirst()
	}

	async findUserById(id: number) {
		return this.db
			.selectFrom("users")
			.where("id", "=", id)
			.selectAll()
			.executeTakeFirst()
	}

	async createUser(email: string, role: UserRole) {
		return this.db
			.insertInto("users")
			.values({
				email: email.toLowerCase(),
				role,
				email_verified: false,
				deactivated: false,
			})
			.returningAll()
			.executeTakeFirstOrThrow()
	}

	async createAuthToken(userId: number, ttlMinutes: number, ipAddress?: string, userAgent?: string) {
		const token = this.generateAuthToken()
		const tokenHash = await this.hashToken(token)

		await this.db
			.insertInto("email_auth_tokens")
			.values({
				user_id: userId,
				token_hash: tokenHash,
				expires_at: sql`NOW() + make_interval(mins => ${ttlMinutes})`,
				ip_address: ipAddress || null,
				user_agent: userAgent || null,
			})
			.execute()

		return token
	}

	async verifyAuthToken(token: string) {
		const tokenHash = await this.hashToken(token)

		const tokenRecord = await this.db
			.selectFrom("email_auth_tokens")
			.where("token_hash", "=", tokenHash)
			.where("used_at", "is", null)
			.where("revoked_at", "is", null)
			.where("expires_at", ">", new Date())
			.selectAll()
			.executeTakeFirst()

		if (!tokenRecord) {
			return undefined
		}

		await this.db
			.updateTable("email_auth_tokens")
			.set({ used_at: new Date() })
			.where("id", "=", tokenRecord.id)
			.execute()

		return this.findUserById(tokenRecord.user_id)
	}

	async revokeUserTokens(userId: number) {
		await this.db
			.updateTable("email_auth_tokens")
			.set({ revoked_at: new Date() })
			.where("user_id", "=", userId)
			.where("revoked_at", "is", null)
			.execute()
	}

	async updateEmailVerified(userId: number) {
		await this.db
			.updateTable("users")
			.set({ email_verified: true })
			.where("id", "=", userId)
			.execute()
	}

	async updateLastActive(userId: number) {
		await this.db
			.updateTable("users")
			.set({ last_active_at: new Date() })
			.where("id", "=", userId)
			.execute()
	}
}

export const authRepo = AuthRepository.getInstance()
