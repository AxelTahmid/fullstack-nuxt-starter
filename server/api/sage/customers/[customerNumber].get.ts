import type { ARCustomerListResponseT, ARCustomerT } from "#shared/sage300"
import { arCustomersGetByCustomerNumber } from "#shared/sage300"
import type { SageCustomerLookup } from "#shared/types/user"
import { requireAdmin } from "~~/server/utils/auth"

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

function text(value: string | undefined) {
	const trimmed = value?.trim()

	return trimmed || null
}

function money(value: number | undefined) {
	return typeof value === "number" ? value : null
}

function toCustomerLookup(customer: ARCustomerT): SageCustomerLookup {
	return {
		customerNumber: customer.CustomerNumber || "",
		customerName: customer.CustomerName?.trim() || customer.ShortName?.trim() || customer.CustomerNumber || "",
		shortName: text(customer.ShortName),
		status: text(customer.Status),
		onHold: text(customer.OnHold),
		accountSet: text(customer.AccountSet),
		priceList: text(customer.CustomerPriceList),
		terms: text(customer.Terms),
		currencyCode: text(customer.CurrencyCode),
		creditLimit: money(customer.CreditLimitCustomerCurrency),
		balanceDue: money(customer.BalanceDueInCustomerCurrency),
		contactName: text(customer.ContactName),
		email: text(customer.Email || customer.ContactsEmail),
		phoneNumber: text(customer.PhoneNumber || customer.ContactsPhone),
		address: [
			customer.AddressLine1,
			customer.AddressLine2,
			customer.AddressLine3,
			customer.AddressLine4,
			[customer.City, customer.StateProvince, customer.ZipPostalCode].filter(Boolean).join(" "),
			customer.Country,
		]
			.map(line => line?.trim())
			.filter((line): line is string => Boolean(line)),
	}
}

export default defineEventHandler(async (event): Promise<SageCustomerLookup> => {
	await requireAdmin(event)
	const customerNumber = getRouterParam(event, "customerNumber")?.trim()

	if (!customerNumber) {
		throw createError({
			statusCode: 400,
			statusMessage: "Customer number is required",
		})
	}

	const response = await arCustomersGetByCustomerNumber({
		path: {
			...sagePath(),
			CustomerNumber: customerNumber,
		},
	})
	const customer = firstCustomer(response.data)

	if (!customer?.CustomerNumber) {
		throw createError({
			statusCode: 404,
			statusMessage: "Customer account not found",
		})
	}

	return toCustomerLookup(customer)
})
