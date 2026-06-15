import { sql, type Kysely } from "kysely"

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("users")
		.addColumn("id", "integer", col => col.generatedAlwaysAsIdentity().primaryKey())
		.addColumn("email", "text", col => col.notNull())
		.addColumn("name", "text")
		.addColumn("role", "text", col => col.notNull().defaultTo("customer"))
		.addColumn("sage_customer_number", "text")
		.addColumn("sage_customer_name", "text")
		.addColumn("email_verified", "boolean", col => col.notNull().defaultTo(false))
		.addColumn("deactivated", "boolean", col => col.notNull().defaultTo(false))
		.addColumn("last_active_at", "timestamptz")
		.addColumn("created_at", "timestamptz", col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.addColumn("updated_at", "timestamptz")
		.addCheckConstraint("users_role_check", sql`role IN ('admin', 'customer')`)
		.execute()

	await db.schema
		.createIndex("users_email_lower_unique")
		.on("users")
		.expression(sql`lower(email)`)
		.unique()
		.execute()

	await db.schema
		.createIndex("users_sage_customer_number_unique")
		.on("users")
		.column("sage_customer_number")
		.unique()
		.where("sage_customer_number", "is not", null)
		.execute()

	await sql`
		CREATE TRIGGER set_users_updated_at
		BEFORE UPDATE ON users
		FOR EACH ROW
		EXECUTE FUNCTION set_updated_at();
	`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("users").ifExists().execute()
}
