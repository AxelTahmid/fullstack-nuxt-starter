import { Kysely, PostgresDialect } from "kysely"
import { Pool } from "pg"
import { hashUserPassword } from "../utils/password"
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

const DEMO_ADMIN_EMAIL = "admin@supplykey.test"
const DEMO_ADMIN_NAME = "Marcus Thorne"

const DEMO_CUSTOMER_EMAIL = "mosaic@supplykey.test"
const DEMO_CUSTOMER_SAGE = "MOSCOL1"
const DEMO_CUSTOMER_NAME = "Mosaic Corporation"

const DEMO_PASSWORD = "aXeL#@12?!455sHaH90!"

async function seedDemoUser(db: Kysely<DB>) {
	console.log("Seeding demo user...")

	const hashedPassword = await hashUserPassword(DEMO_PASSWORD)

	const existingUser = await db
		.selectFrom("users")
		.selectAll()
		.where("email", "=", DEMO_ADMIN_EMAIL)
		.executeTakeFirst()

	if (existingUser) {
		console.log(`demo user already exists (id=${existingUser.id})`)
		return existingUser.id
	}

	const inserted = await db
		.insertInto("users")
		.values({
			email: DEMO_ADMIN_EMAIL,
			name: DEMO_ADMIN_NAME,
			role: "admin",
			password_hash: hashedPassword,
			email_verified: true,
			deactivated: false,
		})
		.returning("id")
		.executeTakeFirstOrThrow()

	console.log(`created demo user (id=${inserted.id})`)
	return inserted.id
}

async function seedDemoCustomer(db: Kysely<DB>) {
	console.log("Seeding demo customer...")

	const hashedPassword = await hashUserPassword(DEMO_PASSWORD)

	const existingCustomer = await db
		.selectFrom("users")
		.selectAll()
		.where("email", "=", DEMO_CUSTOMER_EMAIL)
		.executeTakeFirst()

	if (existingCustomer) {
		console.log(`demo customer already exists (id=${existingCustomer.id})`)
		return existingCustomer.id
	}

	const inserted = await db
		.insertInto("users")
		.values({
			email: DEMO_CUSTOMER_EMAIL,
			name: DEMO_CUSTOMER_NAME,
			sage_customer_number: DEMO_CUSTOMER_SAGE,
			password_hash: hashedPassword,
			email_verified: true,
			deactivated: false,
		})
		.returning("id")
		.executeTakeFirstOrThrow()

	console.log(`created demo customer (id=${inserted.id})`)
	return inserted.id
}

async function seed() {
	const db = getDb()

	try {
		await seedDemoUser(db)
		await seedDemoCustomer(db)

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
