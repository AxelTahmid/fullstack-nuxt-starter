import { sql, type Kysely } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("cart_items")
		.addColumn("id", "integer", col => col.generatedAlwaysAsIdentity().primaryKey())
		.addColumn("user_id", "integer", col => col.notNull().references("users.id").onDelete("cascade"))
		.addColumn("source_key", "text", col => col.notNull())
		.addColumn("quantity", "integer", col => col.notNull())
		.addColumn("created_at", "timestamptz", col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.addColumn("updated_at", "timestamptz")
		.addUniqueConstraint("cart_items_user_source_key_unique", ["user_id", "source_key"])
		.addCheckConstraint("cart_items_quantity_positive", sql`quantity > 0`)
		.execute()

	await db.schema
		.createIndex("cart_items_user_id_idx")
		.on("cart_items")
		.column("user_id")
		.execute()

	await sql`
		CREATE TRIGGER set_cart_items_updated_at
		BEFORE UPDATE ON cart_items
		FOR EACH ROW
		EXECUTE FUNCTION set_updated_at();
	`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("cart_items").ifExists().execute()
}
