import { sql, type Kysely } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("brand_settings")
		.addColumn("id", "integer", col => col.primaryKey())
		.addColumn("org_name", "text", col => col.notNull())
		.addColumn("tagline", "text", col => col.notNull())
		.addColumn("logo_data_url", "text")
		.addColumn("primary_color", "text", col => col.notNull())
		.addColumn("sidebar_color", "text", col => col.notNull())
		.addColumn("accent_color", "text", col => col.notNull())
		.addColumn("created_at", "timestamptz", col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.addColumn("updated_at", "timestamptz")
		.addCheckConstraint("brand_settings_singleton", sql`id = 1`)
		.execute()

	await sql`
		CREATE TRIGGER set_brand_settings_updated_at
		BEFORE UPDATE ON brand_settings
		FOR EACH ROW
		EXECUTE FUNCTION set_updated_at();
	`.execute(db)

	await db
		.insertInto("brand_settings" as never)
		.values({
			id: 1,
			org_name: "SupplyKey",
			tagline: "Mine Supply Company",
			logo_data_url: null,
			primary_color: "#003f63",
			sidebar_color: "#0b1a26",
			accent_color: "#5d3002",
		} as never)
		.execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("brand_settings").ifExists().execute()
}
