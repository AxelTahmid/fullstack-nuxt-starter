import type { ARCustomerListResponseT, ARCustomerT } from "#shared/sage300"
import { arCustomersGetByCustomerNumber } from "#shared/sage300"
import { createUserSchema } from "#shared/schemas/user"
import { auditRepo, authRepo, userRepo } from "~~/server/db/repository"
import { requireAdmin } from "~~/server/utils/auth"
import { generateTemporaryPassword, hashUserPassword } from "~~/server/utils/password"
import { sendUserCredentialEmail } from "~~/server/utils/user-credential-email"
import { toUserListRow } from "~~/server/utils/user-dto"

function sagePath() {
	const { sage300 } = useRuntimeConfig()

	return {
		apiVersion: String(sage300.apiVersion),
		tenant: String(sage300.tenant),
		company: String(sage300.company),
	}
}

function firstCustomer(data: ARCustomerListResponseT | ARCustomerT | undefined) {
	if (!data) {
		return undefined
	}

	if ("value" in data) {
		return data.value?.[0]
	}

	return data as ARCustomerT
}

async function getCustomer(customerNumber: string) {
	const response = await arCustomersGetByCustomerNumber({
		path: {
			...sagePath(),
			CustomerNumber: customerNumber,
		},
	})

	return firstCustomer(response.data)
}

export default defineEventHandler(async (event) => {
	const actor = await requireAdmin(event)
	const body = await readValidatedBody(event, createUserSchema.parse)
	const ipAddress = getRequestIP(event) ?? null
	const userAgent = getRequestHeader(event, "user-agent") ?? null
	const email = body.email.toLowerCase()
	const existingEmail = await authRepo.findUserByEmail(email)

	if (existingEmail) {
		throw createError({
			statusCode: 409,
			statusMessage: "A user with this email already exists",
		})
	}

	let sageCustomerNumber = body.sageCustomerNumber || null
	let sageCustomerName = body.sageCustomerName || null

	if (body.role === "customer" && !sageCustomerNumber) {
		throw createError({
			statusCode: 400,
			statusMessage: "Customer users require a customer account link",
		})
	}

	if (sageCustomerNumber) {
		const existingLink = await userRepo.findUserBySageCustomerNumber(sageCustomerNumber)
		if (existingLink) {
			throw createError({
				statusCode: 409,
				statusMessage: "This customer account is already linked to a user",
			})
		}

		const customer = await getCustomer(sageCustomerNumber)
		if (!customer?.CustomerNumber) {
			throw createError({
				statusCode: 404,
				statusMessage: "Customer account not found",
			})
		}

		sageCustomerNumber = customer.CustomerNumber
		sageCustomerName = customer.CustomerName?.trim() || customer.ShortName?.trim() || sageCustomerName
	}

	const temporaryPassword = generateTemporaryPassword()
	const passwordHash = await hashUserPassword(temporaryPassword)
	const user = await userRepo.createManagedUser({
		email,
		name: body.name?.trim() || null,
		role: body.role,
		sageCustomerNumber,
		sageCustomerName,
		passwordHash,
		passwordResetRequired: true,
	})

	await auditRepo.create({
		actorUserId: actor.id,
		action: "user.create",
		targetType: "user",
		targetId: String(user.id),
		summary: `${actor.email} created user ${user.email}`,
		metadata: {
			role: user.role,
			sageCustomerNumber: user.sage_customer_number,
		},
		ipAddress,
		userAgent,
	})

	const origin = getRequestURL(event).origin
	await sendUserCredentialEmail({
		email: user.email,
		name: user.name,
		temporaryPassword,
		reason: "welcome",
		loginUrl: new URL("/auth/login", origin).toString(),
	})

	return {
		user: toUserListRow(user),
	}
})
