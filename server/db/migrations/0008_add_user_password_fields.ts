import type { Kysely } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("users")
		.addColumn("password_hash", "text")
		.addColumn("password_reset_required", "boolean", col => col.notNull().defaultTo(false))
		.addColumn("password_set_at", "timestamptz")
		.execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("users")
		.dropColumn("password_set_at")
		.dropColumn("password_reset_required")
		.dropColumn("password_hash")
		.execute()
}
