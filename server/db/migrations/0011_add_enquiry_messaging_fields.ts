import { sql, type Kysely } from "kysely"

/**
 * Realtime two-party messaging support for enquiries.
 *
 * - `enquiry_messages.sender_side` makes the customer/support split first-class
 *   instead of inferring it from the free-text `author_role`. Drives UI alignment,
 *   unread counts, and read receipts.
 * - `enquiry_reads` tracks the last message each side has read per enquiry. Kept in
 *   its own table (not columns on `enquiries`) so marking a thread read does NOT
 *   fire the `set_enquiries_updated_at` trigger and re-sort the thread list.
 *   Unread = messages from the other side newer than this side's marker.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("enquiry_messages")
		.addColumn("sender_side", "text", col => col.notNull().defaultTo("customer"))
		.execute()

	await db.schema
		.alterTable("enquiry_messages")
		.addCheckConstraint("enquiry_messages_sender_side_check", sql`sender_side in ('customer', 'support')`)
		.execute()

	// Existing data: supplier-authored rows (author_user_id is null in the demo flow,
	// or role labelled "Supplier") become the support side; everything else stays customer.
	await sql`
		UPDATE enquiry_messages
		SET sender_side = 'support'
		WHERE author_role = 'Supplier' OR author_user_id IS NULL
	`.execute(db)

	await db.schema
		.createTable("enquiry_reads")
		.addColumn("enquiry_id", "integer", col => col.notNull().references("enquiries.id").onDelete("cascade"))
		.addColumn("side", "text", col => col.notNull())
		.addColumn("last_read_message_id", "integer", col => col.notNull().defaultTo(0))
		.addColumn("last_read_at", "timestamptz", col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
		.addPrimaryKeyConstraint("enquiry_reads_pkey", ["enquiry_id", "side"])
		.addCheckConstraint("enquiry_reads_side_check", sql`side in ('customer', 'support')`)
		.execute()

	// Seed both sides as caught-up on existing threads so the rollout does not
	// surface a wall of historical unread counts.
	await sql`
		INSERT INTO enquiry_reads (enquiry_id, side, last_read_message_id)
		SELECT e.id, s.side, COALESCE(lm.max_id, 0)
		FROM enquiries e
		CROSS JOIN (VALUES ('customer'), ('support')) AS s(side)
		LEFT JOIN (
			SELECT enquiry_id, MAX(id) AS max_id
			FROM enquiry_messages
			GROUP BY enquiry_id
		) lm ON lm.enquiry_id = e.id
	`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("enquiry_reads").ifExists().execute()

	// Dropping the column also drops its check constraint in Postgres.
	await db.schema
		.alterTable("enquiry_messages")
		.dropColumn("sender_side")
		.execute()
}
