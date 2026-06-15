import { PgBoss, type ConstructorOptions } from "pg-boss"
import { log } from "#shared/log"
import { Queue } from "#server/db/queue"

declare module "nitropack" {
	interface NitroApp {
		queue?: Queue
	}
}

declare module "h3" {
	interface H3EventContext {
		queue?: Queue
	}
}

export default defineNitroPlugin(async (nitroApp) => {
	const config = useRuntimeConfig()
	const queueConfig = config.pgboss as Record<string, string | number | boolean | undefined>
	const boss = new PgBoss({
		host: String(queueConfig.host || ""),
		port: Number(queueConfig.port || 5432),
		user: String(queueConfig.user || ""),
		password: String(queueConfig.password || ""),
		database: String(queueConfig.database || ""),
		ssl: queueConfig.ssl === "true" ? { rejectUnauthorized: true } : undefined,
		application_name: String(queueConfig.application_name || "fullstack_starter_queue"),
		schema: String(queueConfig.schema || "queue"),
		migrate: queueConfig.migrate !== false && queueConfig.migrate !== "false",
		max: Number(queueConfig.max || 10),
	} satisfies ConstructorOptions)
	const queue = new Queue(boss)

	try {
		await boss.start()
		await queue.setupQueues()
		log.info("✓ Queue initialized")
	}
	catch (error) {
		log.error({ error }, "Failed to start queue")
		throw error
	}

	nitroApp.hooks.hookOnce("close", async () => {
		await boss.stop()
		log.info("✓ Queue stopped")
	})

	nitroApp.queue = queue
})
