import { sql, type Kysely } from "kysely"

/**
 * Product images live in object storage (MinIO/S3); this table is the link between
 * a Sage product (by its source key / UnformattedItemNumber) and the stored objects.
 * Sage stays the source of truth for the product — we only record image metadata.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("product_images")
		.addColumn("id", "integer", col => col.generatedAlwaysAsIdentity().primaryKey())
		.addColumn("source_key", "text", col => col.notNull())
		.addColumn("object_key", "text", col => col.notNull().unique())
		.addColumn("content_type", "text")
		.addColumn("alt", "text")
		.addColumn("sort_order", "integer", col => col.notNull().defaultTo(0))
		.addColumn("is_primary", "boolean", col => col.notNull().defaultTo(false))
		.addColumn("file_size", "integer")
		.addColumn("created_by", "integer", col => col.references("users.id").onDelete("set null"))
		.addColumn("created_at", "timestamptz", col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.execute()

	await db.schema
		.createIndex("product_images_source_idx")
		.on("product_images")
		.columns(["source_key", "sort_order"])
		.execute()

	// At most one primary image per product.
	await sql`
		CREATE UNIQUE INDEX product_images_primary_idx
		ON product_images (source_key)
		WHERE is_primary
	`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("product_images").ifExists().execute()
}
