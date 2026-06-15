import { Kysely, PostgresDialect } from "kysely"
import { Pool } from "pg"
import type { DB } from "./types"

function getDb() {
	const host = process.env.DB_HOST
	const port = process.env.DB_PORT ? Number.parseInt(process.env.DB_PORT, 10) : 5432
	const user = process.env.DB_USER
	const password = process.env.DB_PASSWORD
	const databaseName = process.env.DB_NAME
	const sslEnabled = process.env.DB_SSL === "true"

	if (!host || !user || !password || !databaseName) {
		throw new Error("Database configuration is incomplete")
	}

	return new Kysely<DB>({
		dialect: new PostgresDialect({
			pool: new Pool({
				host,
				port,
				user,
				password,
				database: databaseName,
				max: 5,
				ssl: sslEnabled ? { rejectUnauthorized: true } : false,
			}),
		}),
	})
}

const DEMO_EMAIL = "demo@supplykey.ca"
const DEMO_NAME = "Marcus Thorne"

async function seed() {
	const db = getDb()

	try {
		console.log("Seeding demo user...")
		const existingUser = await db
			.selectFrom("users")
			.selectAll()
			.where("email", "=", DEMO_EMAIL)
			.executeTakeFirst()

		if (existingUser) {
			console.log(`  demo user already exists (id=${existingUser.id})`)
			return
		}

		const inserted = await db
			.insertInto("users")
			.values({
				email: DEMO_EMAIL,
				name: DEMO_NAME,
				role: "admin",
				email_verified: true,
				deactivated: false,
			})
			.returning("id")
			.executeTakeFirstOrThrow()

		console.log(`  created demo user (id=${inserted.id})`)
		console.log("Seed complete")
	}
	finally {
		await db.destroy()
	}
}

seed().catch((error) => {
	console.error(error)
	process.exitCode = 1
})
