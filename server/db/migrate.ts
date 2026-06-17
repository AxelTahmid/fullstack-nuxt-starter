/* eslint-disable import/no-nodejs-modules, no-console, no-restricted-syntax */
import "dotenv/config"
import { Kysely, PostgresDialect } from "kysely"
import {
	type Migration,
	type MigrationProvider,
	type MigrationResult,
	Migrator,
} from "kysely/migration"
import { execSync } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import pg from "pg"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

class FileMigrationProvider implements MigrationProvider {
	constructor(private readonly folder: string) {}

	async getMigrations(): Promise<Record<string, Migration>> {
		const migrations: Record<string, Migration> = {}
		const files = await fs.readdir(this.folder)

		await Promise.all(
			files
				.filter(
					f =>
						(f.endsWith(".ts") || f.endsWith(".js")) && !f.endsWith(".d.ts"),
				)
				.map(async (f) => {
					const name = f.replace(/\.(ts|js)$/, "")
					const url = pathToFileURL(path.join(this.folder, f)).href
					migrations[name] = await import(url)
				}),
		)

		return migrations
	}
}

function createDb() {
	return new Kysely({
		dialect: new PostgresDialect({
			pool: new pg.Pool({
				host: process.env.DB_HOST,
				port: Number(process.env.DB_PORT) || 5432,
				user: process.env.DB_USER,
				password: process.env.DB_PASSWORD,
				database: process.env.DB_NAME,
			}),
		}),
	})
}

function createMigrator(db: Kysely<unknown>) {
	return new Migrator({
		db,
		provider: new FileMigrationProvider(path.join(__dirname, "migrations")),
	})
}

async function migrateUp() {
	const db = createDb()
	const { error, results } = await createMigrator(db).migrateUp()

	results?.forEach((r: MigrationResult) => {
		if (r.status === "Success") console.log(`  ✓ ${r.migrationName}`)
		else if (r.status === "Error") console.error(`  ✗ ${r.migrationName}`)
	})

	if (error) {
		console.error("Migration failed:", error)
		await db.destroy()
		process.exit(1)
	}

	if (!results?.length) console.log("  No pending migrations.")
	else console.log("  Done.")

	await db.destroy()
	process.exit(0)
}

async function migrateDown() {
	const db = createDb()
	const { error, results } = await createMigrator(db).migrateDown()

	results?.forEach((r: MigrationResult) => {
		if (r.status === "Success")
			console.log(`  ✓ rolled back ${r.migrationName}`)
		else if (r.status === "Error") console.error(`  ✗ ${r.migrationName}`)
	})

	if (error) {
		console.error("Rollback failed:", error)
		await db.destroy()
		process.exit(1)
	}

	if (!results?.length) console.log("  Nothing to roll back.")
	else console.log("  Done.")

	await db.destroy()
	process.exit(0)
}

async function migrateLatest() {
	const db = createDb()
	const { error, results } = await createMigrator(db).migrateToLatest()

	results?.forEach((r: MigrationResult) => {
		if (r.status === "Success") console.log(`  ✓ ${r.migrationName}`)
		else if (r.status === "Error") console.error(`  ✗ ${r.migrationName}`)
	})

	if (error) {
		console.error("Migration failed:", error)
		await db.destroy()
		process.exit(1)
	}

	if (!results?.length) console.log("  Already up to date.")
	else console.log(`  ${results.length} migration(s) applied.`)

	await db.destroy()
	process.exit(0)
}

async function migrateReset() {
	const db = createDb()
	const migrator = createMigrator(db)

	console.log("Rolling back all migrations...")
	let rolledBack = 0
	while (true) {
		const { error, results } = await migrator.migrateDown()
		if (error) {
			console.error("Rollback failed:", error)
			await db.destroy()
			process.exit(1)
		}
		if (!results?.length) break
		results.forEach((r: MigrationResult) => {
			if (r.status === "Success")
				console.log(`  ✓ rolled back ${r.migrationName}`)
			else if (r.status === "Error") console.error(`  ✗ ${r.migrationName}`)
		})
		rolledBack += results.length
	}
	console.log(`  ${rolledBack} migration(s) rolled back.`)

	console.log("\nRunning all migrations...")
	const { error: upError, results: upResults }
		= await migrator.migrateToLatest()
	upResults?.forEach((r: MigrationResult) => {
		if (r.status === "Success") console.log(`  ✓ ${r.migrationName}`)
		else if (r.status === "Error") console.error(`  ✗ ${r.migrationName}`)
	})
	if (upError) {
		console.error("Migration failed:", upError)
		await db.destroy()
		process.exit(1)
	}
	console.log(`  ${upResults?.length ?? 0} migration(s) applied.`)

	await db.destroy()

	console.log("\nSeeding...")
	try {
		execSync("npx tsx db/seed.ts", {
			stdio: "inherit",
			cwd: path.join(__dirname, ".."),
		})
	}
	catch {
		console.error("  Seed failed.")
		process.exit(1)
	}

	process.exit(0)
}

async function migrateStatus() {
	const db = createDb()
	const migrations = await createMigrator(db).getMigrations()

	if (!migrations.length) {
		console.log("  No migrations found.")
	}
	else {
		console.log("\nMigration status:\n")
		for (const m of migrations) {
			const status = m.executedAt
				? `✓ ${m.executedAt.toISOString()}`
				: "  pending"
			console.log(`  ${status}  ${m.name}`)
		}
		console.log("")
	}

	await db.destroy()
	process.exit(0)
}

const command = process.argv[2]

switch (command) {
	case "up":
		migrateUp()
		break
	case "down":
		migrateDown()
		break
	case "latest":
		migrateLatest()
		break
	case "status":
		migrateStatus()
		break
	case "reset":
		migrateReset()
		break
	default:
		console.error(`Unknown command: ${command ?? "(none)"}`)
		console.log("\nUsage: tsx database/migrate.ts <command>")
		console.log("\nCommands:")
		console.log("  up      Run next pending migration")
		console.log("  down    Roll back last migration")
		console.log("  latest  Run all pending migrations")
		console.log("  status  Show migration status")
		console.log("  reset   Roll back all, migrate to latest, seed")
		process.exit(1)
}
