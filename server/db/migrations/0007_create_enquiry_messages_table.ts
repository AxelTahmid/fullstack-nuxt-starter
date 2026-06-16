import { sql, type Kysely } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("enquiry_messages")
		.addColumn("id", "integer", col => col.generatedAlwaysAsIdentity().primaryKey())
		.addColumn("enquiry_id", "integer", col => col.notNull().references("enquiries.id").onDelete("cascade"))
		.addColumn("author_user_id", "integer", col => col.references("users.id").onDelete("set null"))
		.addColumn("author_name", "text", col => col.notNull())
		.addColumn("author_role", "text", col => col.notNull())
		.addColumn("body", "text", col => col.notNull())
		.addColumn("attachment_name", "text")
		.addColumn("created_at", "timestamptz", col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute()

	await db.schema
		.createIndex("enquiry_messages_enquiry_created_idx")
		.on("enquiry_messages")
		.columns(["enquiry_id", "created_at"])
		.execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("enquiry_messages").ifExists().execute()
}
