import { sql, type Kysely } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("audit_logs")
		.addColumn("id", "integer", col => col.generatedAlwaysAsIdentity().primaryKey())
		.addColumn("actor_user_id", "integer", col => col.references("users.id").onDelete("set null"))
		.addColumn("action", "text", col => col.notNull())
		.addColumn("target_type", "text", col => col.notNull())
		.addColumn("target_id", "text")
		.addColumn("summary", "text", col => col.notNull())
		.addColumn("metadata", "jsonb", col => col.notNull().defaultTo(sql`'{}'::jsonb`))
		.addColumn("ip_address", "text")
		.addColumn("user_agent", "text")
		.addColumn("created_at", "timestamptz", col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute()

	await db.schema
		.createIndex("audit_logs_actor_created_idx")
		.on("audit_logs")
		.columns(["actor_user_id", "created_at"])
		.execute()

	await db.schema
		.createIndex("audit_logs_target_created_idx")
		.on("audit_logs")
		.columns(["target_type", "target_id", "created_at"])
		.execute()

	await db.schema
		.createIndex("audit_logs_action_created_idx")
		.on("audit_logs")
		.columns(["action", "created_at"])
		.execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("audit_logs").ifExists().execute()
}
