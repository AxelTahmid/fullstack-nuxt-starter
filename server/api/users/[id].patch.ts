import type { ARCustomerListResponseT, ARCustomerT } from "#shared/sage300"
import { arCustomersGetByCustomerNumber } from "#shared/sage300"
import { updateUserSchema } from "#shared/schemas/user"
import { auditRepo, authRepo, userRepo } from "~~/server/db/repository"
import { requireAdmin } from "~~/server/utils/auth"
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

function parseId(value: string | undefined) {
	const id = Number.parseInt(value || "", 10)

	if (!Number.isInteger(id) || id <= 0) {
		throw createError({
			statusCode: 400,
			statusMessage: "Valid user id is required",
		})
	}

	return id
}

export default defineEventHandler(async (event) => {
	const actor = await requireAdmin(event)
	const id = parseId(getRouterParam(event, "id"))
	const body = await readValidatedBody(event, updateUserSchema.parse)
	const existing = await userRepo.findUserById(id)
	const ipAddress = getRequestIP(event) ?? null
	const userAgent = getRequestHeader(event, "user-agent") ?? null

	if (Object.keys(body).length === 0) {
		throw createError({
			statusCode: 400,
			statusMessage: "At least one field is required",
		})
	}

	if (!existing) {
		throw createError({
			statusCode: 404,
			statusMessage: "User not found",
		})
	}

	const nextEmail = body.email?.toLowerCase()
	if (nextEmail && nextEmail !== existing.email) {
		const duplicate = await authRepo.findUserByEmail(nextEmail)
		if (duplicate) {
			throw createError({
				statusCode: 409,
				statusMessage: "A user with this email already exists",
			})
		}
	}

	let sageCustomerNumber = body.sageCustomerNumber
	let sageCustomerName = body.sageCustomerName

	if (sageCustomerNumber === null && sageCustomerName === undefined) {
		sageCustomerName = null
	}

	if (sageCustomerNumber) {
		const duplicateLink = await userRepo.findUserBySageCustomerNumber(sageCustomerNumber)
		if (duplicateLink && duplicateLink.id !== existing.id) {
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

	const nextRole = body.role ?? existing.role
	const nextCustomerNumber = sageCustomerNumber === undefined ? existing.sage_customer_number : sageCustomerNumber

	if (nextRole === "customer" && !nextCustomerNumber) {
		throw createError({
			statusCode: 400,
			statusMessage: "Customer users require a customer account link",
		})
	}

	const user = await userRepo.updateManagedUser(id, {
		email: nextEmail,
		name: body.name,
		role: body.role,
		sageCustomerNumber,
		sageCustomerName,
		deactivated: body.deactivated,
	})

	if (!user) {
		throw createError({
			statusCode: 404,
			statusMessage: "User not found",
		})
	}

	await auditRepo.create({
		actorUserId: actor.id,
		action: "user.update",
		targetType: "user",
		targetId: String(user.id),
		summary: `${actor.email} updated user ${user.email}`,
		metadata: {
			before: {
				email: existing.email,
				name: existing.name,
				role: existing.role,
				sageCustomerNumber: existing.sage_customer_number,
				sageCustomerName: existing.sage_customer_name,
				deactivated: existing.deactivated,
			},
			after: {
				email: user.email,
				name: user.name,
				role: user.role,
				sageCustomerNumber: user.sage_customer_number,
				sageCustomerName: user.sage_customer_name,
				deactivated: user.deactivated,
			},
		},
		ipAddress,
		userAgent,
	})

	return {
		user: toUserListRow(user),
	}
})
