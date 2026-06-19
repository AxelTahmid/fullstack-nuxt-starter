import { sql, type SqlBool } from "kysely"
import type { MessageSenderSide } from "#shared/types/enquiry"
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
	senderSide: MessageSenderSide
	body: string
	attachmentName?: string | null
}

interface ListSummariesOptions {
	/** Scope to one customer's enquiries; omit for the admin/support view. */
	userId?: number
	/** Side the requesting viewer reads as; drives the unread count. */
	viewerSide: MessageSenderSide
}

export interface EnquiryReadMarkers {
	customer: number | null
	support: number | null
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
	 * Summary rows with the latest message preview plus the viewer's unread count.
	 * Pass `userId` to scope to one customer; omit for admin views. Newest activity first.
	 */
	async listSummaries(opts: ListSummariesOptions) {
		const otherSide: MessageSenderSide = opts.viewerSide === "customer" ? "support" : "customer"

		let query = this.db
			.selectFrom("enquiries as e")
			.leftJoin("enquiry_reads as r", join =>
				join.onRef("r.enquiry_id", "=", "e.id").on("r.side", "=", opts.viewerSide))
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
				eb
					.selectFrom("enquiry_messages as um")
					.select(ub => ub.fn.count<number>("um.id").as("c"))
					.whereRef("um.enquiry_id", "=", "e.id")
					.where("um.sender_side", "=", otherSide)
					.where(sql<SqlBool>`um.id > COALESCE(r.last_read_message_id, 0)`)
					.as("unread_count"),
			])
			.orderBy(sql`COALESCE(e.updated_at, e.created_at)`, "desc")

		if (opts.userId !== undefined) {
			query = query.where("e.user_id", "=", opts.userId)
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

	/** Last-read message id per side for an enquiry; powers read receipts. */
	async getReadMarkers(enquiryId: number): Promise<EnquiryReadMarkers> {
		const rows = await this.db
			.selectFrom("enquiry_reads")
			.select(["side", "last_read_message_id"])
			.where("enquiry_id", "=", enquiryId)
			.execute()

		return {
			customer: rows.find(row => row.side === "customer")?.last_read_message_id ?? null,
			support: rows.find(row => row.side === "support")?.last_read_message_id ?? null,
		}
	}

	async getLatestMessageId(enquiryId: number) {
		const row = await this.db
			.selectFrom("enquiry_messages")
			.select(eb => eb.fn.max<number | null>("id").as("max_id"))
			.where("enquiry_id", "=", enquiryId)
			.executeTakeFirst()

		return row?.max_id ?? null
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

			const firstMessage = await trx
				.insertInto("enquiry_messages")
				.values({
					enquiry_id: enquiry.id,
					author_user_id: input.firstMessage.authorUserId,
					author_name: input.firstMessage.authorName,
					author_role: input.firstMessage.authorRole,
					sender_side: "customer",
					body: input.firstMessage.body,
				})
				.returningAll()
				.executeTakeFirstOrThrow()

			// The customer has read their own opening message; support has not.
			await trx
				.insertInto("enquiry_reads")
				.values({ enquiry_id: enquiry.id, side: "customer", last_read_message_id: firstMessage.id })
				.execute()

			return { enquiry, firstMessage }
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
					sender_side: input.senderSide,
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

			// The author has implicitly read up to their own message.
			await trx
				.insertInto("enquiry_reads")
				.values({ enquiry_id: enquiryId, side: input.senderSide, last_read_message_id: message.id })
				.onConflict(oc => oc
					.columns(["enquiry_id", "side"])
					.doUpdateSet({
						last_read_message_id: sql`GREATEST(enquiry_reads.last_read_message_id, EXCLUDED.last_read_message_id)`,
						last_read_at: sql`CURRENT_TIMESTAMP`,
					}))
				.execute()

			return message
		})
	}

	/** Advance a side's read marker (forward only) and return the new value. */
	async markRead(enquiryId: number, side: MessageSenderSide, messageId: number) {
		await this.db
			.insertInto("enquiry_reads")
			.values({ enquiry_id: enquiryId, side, last_read_message_id: messageId })
			.onConflict(oc => oc
				.columns(["enquiry_id", "side"])
				.doUpdateSet({
					last_read_message_id: sql`GREATEST(enquiry_reads.last_read_message_id, EXCLUDED.last_read_message_id)`,
					last_read_at: sql`CURRENT_TIMESTAMP`,
				}))
			.execute()

		const row = await this.db
			.selectFrom("enquiry_reads")
			.select("last_read_message_id")
			.where("enquiry_id", "=", enquiryId)
			.where("side", "=", side)
			.executeTakeFirst()

		return row?.last_read_message_id ?? messageId
	}

	/** Count of non-resolved enquiries. Pass `userId` to scope to one customer. */
	async countOpen(userId?: number) {
		let query = this.db
			.selectFrom("enquiries")
			.select(eb => eb.fn.count<number>("id").as("c"))
			.where("status", "!=", "resolved")

		if (userId !== undefined) {
			query = query.where("user_id", "=", userId)
		}

		const row = await query.executeTakeFirstOrThrow()
		return Number(row.c)
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
