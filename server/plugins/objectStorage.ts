import { log } from "#shared/log"
import { ensureProductImageBucket } from "~~/server/utils/objectStorage"

/**
 * Ensure the product-image bucket exists and is publicly readable on startup.
 * Non-fatal: if MinIO isn't reachable yet, the app still boots — uploads will fail
 * until storage is available, and a restart re-runs this.
 */
export default defineNitroPlugin(async () => {
	try {
		await ensureProductImageBucket()
		log.info("✓ Object storage bucket ready")
	}
	catch (error) {
		log.error({ error }, "Object storage bucket init failed; product image uploads need MinIO reachable")
	}
})
