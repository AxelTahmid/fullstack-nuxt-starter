import { sql, type Kysely } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("enquiries")
		.addColumn("id", "integer", col => col.generatedAlwaysAsIdentity().primaryKey())
		.addColumn("user_id", "integer", col => col.notNull().references("users.id").onDelete("cascade"))
		.addColumn("enquiry_number", "text", col => col.notNull().unique())
		.addColumn("subject", "text", col => col.notNull())
		.addColumn("product_sku", "text")
		.addColumn("supplier_name", "text", col => col.notNull().defaultTo("SupplyKey"))
		.addColumn("status", "text", col => col.notNull().defaultTo("sent"))
		.addColumn("priority", "text", col => col.notNull().defaultTo("medium"))
		// Optional linkage to a Sage document (e.g. an OE quote/order number).
		.addColumn("source_type", "text", col => col.notNull().defaultTo("general"))
		.addColumn("source_reference", "text")
		.addColumn("created_at", "timestamptz", col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.addColumn("updated_at", "timestamptz")
		.execute()

	await db.schema
		.createIndex("enquiries_user_updated_idx")
		.on("enquiries")
		.columns(["user_id", "updated_at"])
		.execute()

	await db.schema
		.createIndex("enquiries_status_updated_idx")
		.on("enquiries")
		.columns(["status", "updated_at"])
		.execute()

	await db.schema
		.createIndex("enquiries_source_idx")
		.on("enquiries")
		.columns(["source_type", "source_reference"])
		.execute()

	await sql`
		CREATE TRIGGER set_enquiries_updated_at
		BEFORE UPDATE ON enquiries
		FOR EACH ROW
		EXECUTE FUNCTION set_updated_at();
	`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("enquiries").ifExists().execute()
}
