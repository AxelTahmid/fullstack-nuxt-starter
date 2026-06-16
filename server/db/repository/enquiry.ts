import { sql } from "kysely"
import { Database } from "../base"

interface FirstMessageInput {
	authorUserId: number | null
	authorName: string
	authorRole: string
	body: string
}

interface CreateEnquiryInput {
	userId: number
	enquiryNumber: string
	subject: string
	supplierName: string
	productSku: string | null
	priority: string
	sourceType?: string
	sourceReference?: string | null
	firstMessage: FirstMessageInput
}

interface AddMessageInput {
	authorUserId: number | null
	authorName: string
	authorRole: string
	body: string
	attachmentName?: string | null
}

class EnquiryRepository extends Database {
	private static enquiryInstance: EnquiryRepository | null = null

	private constructor() {
		super(Database.getInstance().getQueryBuilder())
	}

	static override getInstance() {
		if (!EnquiryRepository.enquiryInstance) {
			EnquiryRepository.enquiryInstance = new EnquiryRepository()
		}

		return EnquiryRepository.enquiryInstance
	}

	/**
	 * Summary rows with the latest message preview. Pass `userId` to scope to one
	 * customer; omit for admin views. Newest activity first.
	 */
	async listSummaries(userId?: number) {
		let query = this.db
			.selectFrom("enquiries as e")
			.select(eb => [
				"e.id",
				"e.enquiry_number",
				"e.subject",
				"e.product_sku",
				"e.supplier_name",
				"e.status",
				"e.priority",
				sql<Date>`COALESCE(e.updated_at, e.created_at)`.as("updated_at"),
				eb
					.selectFrom("enquiry_messages as m")
					.select("m.body")
					.whereRef("m.enquiry_id", "=", "e.id")
					.orderBy("m.created_at", "desc")
					.limit(1)
					.as("last_message_preview"),
			])
			.orderBy(sql`COALESCE(e.updated_at, e.created_at)`, "desc")

		if (userId !== undefined) {
			query = query.where("e.user_id", "=", userId)
		}

		return query.execute()
	}

	async findByNumber(enquiryNumber: string) {
		return this.db
			.selectFrom("enquiries")
			.selectAll()
			.where("enquiry_number", "=", enquiryNumber)
			.executeTakeFirst()
	}

	async listMessages(enquiryId: number) {
		return this.db
			.selectFrom("enquiry_messages")
			.selectAll()
			.where("enquiry_id", "=", enquiryId)
			.orderBy("created_at", "asc")
			.execute()
	}

	async createWithFirstMessage(input: CreateEnquiryInput) {
		return this.db.transaction().execute(async (trx) => {
			const enquiry = await trx
				.insertInto("enquiries")
				.values({
					user_id: input.userId,
					enquiry_number: input.enquiryNumber,
					subject: input.subject,
					supplier_name: input.supplierName,
					product_sku: input.productSku,
					status: "sent",
					priority: input.priority,
					source_type: input.sourceType ?? "general",
					source_reference: input.sourceReference ?? null,
				})
				.returningAll()
				.executeTakeFirstOrThrow()

			await trx
				.insertInto("enquiry_messages")
				.values({
					enquiry_id: enquiry.id,
					author_user_id: input.firstMessage.authorUserId,
					author_name: input.firstMessage.authorName,
					author_role: input.firstMessage.authorRole,
					body: input.firstMessage.body,
				})
				.execute()

			return enquiry
		})
	}

	async addMessage(enquiryId: number, input: AddMessageInput) {
		return this.db.transaction().execute(async (trx) => {
			const message = await trx
				.insertInto("enquiry_messages")
				.values({
					enquiry_id: enquiryId,
					author_user_id: input.authorUserId,
					author_name: input.authorName,
					author_role: input.authorRole,
					body: input.body,
					attachment_name: input.attachmentName ?? null,
				})
				.returningAll()
				.executeTakeFirstOrThrow()

			// Touch the parent so the thread re-sorts; the trigger refreshes updated_at.
			await trx
				.updateTable("enquiries")
				.set({ updated_at: sql`CURRENT_TIMESTAMP` })
				.where("id", "=", enquiryId)
				.execute()

			return message
		})
	}

	async updateEnquiry(enquiryId: number, patch: { status?: string, priority?: string }) {
		return this.db
			.updateTable("enquiries")
			.set(patch)
			.where("id", "=", enquiryId)
			.returningAll()
			.executeTakeFirst()
	}
}

export const enquiryRepo = EnquiryRepository.getInstance()
