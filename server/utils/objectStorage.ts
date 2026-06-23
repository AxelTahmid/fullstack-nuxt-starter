import { randomUUID } from "node:crypto"
import { Client as MinioClient } from "minio"

interface MinioConfig {
	endpoint: string
	port: number
	useSSL: boolean
	region: string
	accessKey: string
	secretKey: string
	bucket: string
	publicUrl: string
}

// Two clients on purpose:
// - `ops` talks to MinIO over the server-side host (Docker network `minio:9000`) for
//   bucket setup and deletes.
// - `presign` is configured with the BROWSER-facing host (MINIO_PUBLIC_URL) so the
//   upload URLs it signs resolve and validate from the user's browser.
let opsClient: MinioClient | null = null
let presignClient: MinioClient | null = null

function config(): MinioConfig {
	return useRuntimeConfig().minio as unknown as MinioConfig
}

function getOpsClient() {
	if (opsClient) {
		return opsClient
	}
	const c = config()
	opsClient = new MinioClient({
		endPoint: c.endpoint,
		port: c.port,
		useSSL: c.useSSL,
		region: c.region,
		accessKey: c.accessKey,
		secretKey: c.secretKey,
	})
	return opsClient
}

function getPresignClient() {
	if (presignClient) {
		return presignClient
	}
	const c = config()
	const url = new URL(c.publicUrl)
	presignClient = new MinioClient({
		endPoint: url.hostname,
		port: url.port ? Number(url.port) : (url.protocol === "https:" ? 443 : 80),
		useSSL: url.protocol === "https:",
		region: c.region,
		accessKey: c.accessKey,
		secretKey: c.secretKey,
	})
	return presignClient
}

/** Create the bucket if missing and make objects publicly readable (for display). */
export async function ensureProductImageBucket() {
	const c = config()
	const client = getOpsClient()
	const exists = await client.bucketExists(c.bucket)
	if (!exists) {
		await client.makeBucket(c.bucket)
	}
	const policy = {
		Version: "2012-10-17",
		Statement: [{
			Effect: "Allow",
			Principal: { AWS: ["*"] },
			Action: ["s3:GetObject"],
			Resource: [`arn:aws:s3:::${c.bucket}/*`],
		}],
	}
	await client.setBucketPolicy(c.bucket, JSON.stringify(policy))
}

/** Deterministic, collision-free object key under the product's source key. */
export function buildProductImageKey(sourceKey: string, fileName: string) {
	const ext = (fileName.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin"
	const safeKey = sourceKey.replace(/[^a-zA-Z0-9._-]/g, "_")
	return `products/${safeKey}/${randomUUID()}.${ext}`
}

/** A short-lived presigned PUT URL the browser uploads the file to. */
export async function presignProductImageUpload(objectKey: string, expirySeconds = 300) {
	const c = config()
	return getPresignClient().presignedPutObject(c.bucket, objectKey, expirySeconds)
}

/** The public (browser) URL for displaying a stored object. */
export function productImagePublicUrl(objectKey: string) {
	const c = config()
	return `${c.publicUrl.replace(/\/$/, "")}/${c.bucket}/${objectKey}`
}

export async function removeProductImageObject(objectKey: string) {
	const c = config()
	await getOpsClient().removeObject(c.bucket, objectKey)
}

/** Whether an object actually exists (used to avoid recording rows for failed uploads). */
export async function productImageObjectExists(objectKey: string) {
	const c = config()
	try {
		await getOpsClient().statObject(c.bucket, objectKey)
		return true
	}
	catch {
		return false
	}
}
