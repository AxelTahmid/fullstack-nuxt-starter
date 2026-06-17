import { randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scryptAsync = promisify(scrypt)
const KEY_LENGTH = 64

export function generateTemporaryPassword() {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%+=?"
	const bytes = randomBytes(18)

	return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("")
}

export async function hashUserPassword(password: string) {
	const salt = randomBytes(16).toString("base64url")
	const derivedKey = await scryptAsync(password, salt, KEY_LENGTH) as Buffer

	return `scrypt$${salt}$${derivedKey.toString("base64url")}`
}

export async function verifyUserPassword(password: string, storedHash: string | null) {
	if (!storedHash) {
		return false
	}

	const [scheme, salt, key] = storedHash.split("$")
	if (scheme !== "scrypt" || !salt || !key) {
		return false
	}

	const expected = Buffer.from(key, "base64url")
	const actual = await scryptAsync(password, salt, expected.length) as Buffer

	return expected.length === actual.length && timingSafeEqual(expected, actual)
}
