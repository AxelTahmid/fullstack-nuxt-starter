import { sql, type Insertable, type Updateable } from "kysely"
import type { UserRole } from "#shared/types/user"
import type { Users } from "../types"
import { Database } from "../base"

export interface CreateManagedUserInput {
	email: string
	name: string | null
	role: UserRole
	sageCustomerNumber: string | null
	sageCustomerName: string | null
	passwordHash: string
	passwordResetRequired: boolean
}

export interface UpdateManagedUserInput {
	email?: string
	name?: string | null
	role?: UserRole
	sageCustomerNumber?: string | null
	sageCustomerName?: string | null
	deactivated?: boolean
}

class UserRepository extends Database {
	private static userInstance: UserRepository | null = null

	private constructor() {
		super(Database.getInstance().getQueryBuilder())
	}

	static override getInstance() {
		if (!UserRepository.userInstance) {
			UserRepository.userInstance = new UserRepository()
		}

		return UserRepository.userInstance
	}

	async countUsers() {
		const result = await this.db
			.selectFrom("users")
			.select(eb => eb.fn.count<number>("id").as("count"))
			.executeTakeFirstOrThrow()

		return Number(result.count)
	}

	async listUsers() {
		return this.db
			.selectFrom("users")
			.selectAll()
			.orderBy("created_at", "desc")
			.execute()
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

	/** Active admins, used as the support-side recipients for enquiry notifications. */
	async listActiveAdmins() {
		return this.db
			.selectFrom("users")
			.select(["id", "email", "name"])
			.where("role", "=", "admin")
			.where("deactivated", "=", false)
			.execute()
	}

	async findUserBySageCustomerNumber(sageCustomerNumber: string) {
		return this.db
			.selectFrom("users")
			.where("sage_customer_number", "=", sageCustomerNumber)
			.selectAll()
			.executeTakeFirst()
	}

	async createManagedUser(input: CreateManagedUserInput) {
		const values: Insertable<Users> = {
			email: input.email.toLowerCase(),
			name: input.name,
			role: input.role,
			sage_customer_number: input.sageCustomerNumber,
			sage_customer_name: input.sageCustomerName,
			email_verified: true,
			deactivated: false,
			password_hash: input.passwordHash,
			password_reset_required: input.passwordResetRequired,
			password_set_at: new Date(),
		}

		return this.db
			.insertInto("users")
			.values(values)
			.returningAll()
			.executeTakeFirstOrThrow()
	}

	async updateManagedUser(id: number, input: UpdateManagedUserInput) {
		const patch: Updateable<Users> = {}

		if (input.email !== undefined) patch.email = input.email.toLowerCase()
		if (input.name !== undefined) patch.name = input.name
		if (input.role !== undefined) patch.role = input.role
		if (input.sageCustomerNumber !== undefined) patch.sage_customer_number = input.sageCustomerNumber
		if (input.sageCustomerName !== undefined) patch.sage_customer_name = input.sageCustomerName
		if (input.deactivated !== undefined) patch.deactivated = input.deactivated

		return this.db
			.updateTable("users")
			.set(patch)
			.where("id", "=", id)
			.returningAll()
			.executeTakeFirst()
	}

	async updatePassword(id: number, passwordHash: string, passwordResetRequired: boolean) {
		return this.db
			.updateTable("users")
			.set({
				password_hash: passwordHash,
				password_reset_required: passwordResetRequired,
				password_set_at: new Date(),
			})
			.where("id", "=", id)
			.returningAll()
			.executeTakeFirst()
	}

	async recentUsers(limit = 5) {
		return this.db
			.selectFrom("users")
			.selectAll()
			.orderBy("created_at", "desc")
			.limit(limit)
			.execute()
	}

	async getDashboardStats() {
		const [users, verifiedUsers, admins] = await Promise.all([
			this.db.selectFrom("users").select(eb => eb.fn.count<number>("id").as("count")).executeTakeFirstOrThrow(),
			this.db.selectFrom("users").where("email_verified", "=", true).select(eb => eb.fn.count<number>("id").as("count")).executeTakeFirstOrThrow(),
			this.db.selectFrom("users").where("role", "=", "admin").select(eb => eb.fn.count<number>("id").as("count")).executeTakeFirstOrThrow(),
		])

		return {
			users: Number(users.count),
			verifiedUsers: Number(verifiedUsers.count),
			admins: Number(admins.count),
		}
	}
}

export const userRepo = UserRepository.getInstance()
