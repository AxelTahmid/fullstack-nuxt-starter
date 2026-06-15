import { sql, type Kysely } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("email_auth_tokens")
		.addColumn("id", "integer", col => col.generatedAlwaysAsIdentity().primaryKey())
		.addColumn("user_id", "integer", col => col.notNull().references("users.id").onDelete("cascade"))
		.addColumn("token_hash", "text", col => col.notNull().unique())
		.addColumn("expires_at", "timestamptz", col => col.notNull())
		.addColumn("used_at", "timestamptz")
		.addColumn("revoked_at", "timestamptz")
		.addColumn("ip_address", "text")
		.addColumn("user_agent", "text")
		.addColumn("created_at", "timestamptz", col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute()

	await db.schema
		.createIndex("email_auth_tokens_user_id_idx")
		.on("email_auth_tokens")
		.column("user_id")
		.execute()

	await db.schema
		.createIndex("email_auth_tokens_expires_at_idx")
		.on("email_auth_tokens")
		.column("expires_at")
		.execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("email_auth_tokens").ifExists().execute()
}
