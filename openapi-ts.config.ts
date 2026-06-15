import { defaultPaginationKeywords, defineConfig } from "@hey-api/openapi-ts"
import "dotenv/config"

// "openapi": "node -r dotenv/config ./node_modules/.bin/openapi-ts"

// const username = process.env.OPENAPI_USERNAME
// const password = process.env.OPENAPI_PASSWORD
const apiBaseUrl = process.env.SAGE300_OPENAPI_SPEC

if (!apiBaseUrl) {
	throw new Error("SAGE300_OPENAPI_SPEC is not defined in environment variables.")
}
// if ((username && !password) || (!username && password)) {
// 	throw new Error("Both OPENAPI_USERNAME and OPENAPI_PASSWORD must be set together.")
// }

// const auth = Buffer.from(`${username}:${password}`).toString("base64")

// Path params shared by every Sage 300 OData route. They live in the
// `/v{apiVersion}/{tenant}/{company}` prefix and add no meaning to the
// generated symbol names, so we drop them when building operation ids.
const SHARED_PATH_PARAMS = new Set(["apiVersion", "tenant", "company"])

/**
 * Builds a concise `operationId` from an OData route. The Sage 300 spec ships
 * no operation ids, so @hey-api derives names from `METHOD + path` — which bakes
 * the shared `/v{apiVersion}/{tenant}/{company}` prefix into every SDK function,
 * type, and zod schema (e.g. `arCustomersGetByApiversionAndTenantAndCompany`).
 *
 * Setting the id here (before parsing) shortens the name everywhere downstream:
 *   GET  /v{apiVersion}/{tenant}/{company}/AR/ARCustomers
 *     -> ARCustomersGet                      -> arCustomersGet / ArCustomersGetData
 *   GET  /v{apiVersion}/{tenant}/{company}/AR/ARCustomers('{CustomerNumber}')
 *     -> ARCustomersGetByCustomerNumber      -> arCustomersGetByCustomerNumber
 */
function buildOperationId(method: string, path: string, tag: string | undefined): string {
	// OData key params, e.g. {CustomerNumber}, minus the shared prefix params.
	const keys = Array.from(path.matchAll(/\{([^}]+)\}/g), match => match[1])
		.filter((key): key is string => Boolean(key) && !SHARED_PATH_PARAMS.has(key))

	// Last route segment with any OData key suffix `(...)` stripped off, e.g.
	// `ARCustomers` from `/AR/ARCustomers('{CustomerNumber}')`.
	const lastSegment = path
		.split("/")
		.filter(Boolean)
		.pop()
		?.replace(/\(.*\)$/, "")

	// Prefer the entity set tag (`ARCustomers`); fall back to the route segment.
	const entity = tag?.trim() || lastSegment || "operation"

	const verb = method.charAt(0).toUpperCase() + method.slice(1).toLowerCase()
	const byKeys = keys.length
		? `By${keys.map(key => key.charAt(0).toUpperCase() + key.slice(1)).join("And")}`
		: ""

	return `${entity}${verb}${byKeys}`
}

/**
 * Strips the verbose Sage .NET namespace from a model schema name. Sage ships
 * its models as fully-qualified types like
 * `Sage.CA.SBS.ERP.Sage300.OE.WebApi.Models.Order`, which @hey-api turns into
 * `SageCaSbsErpSage300OeWebApiModelsOrder`. We keep only the module token as an
 * uppercased prefix, e.g. `OEOrder` / `ICItem` / `ARCustomer`.
 *
 * Also collapses the OData list envelope that wraps collection responses,
 * `Swashbuckle.OData.ODataResponse[System.Collections.Generic.List[<inner>]]`,
 * into `<Inner>ListResponse` (e.g. `ARCustomerListResponse`).
 *
 * Non-Sage framework schemas (`System.*`, `Microsoft.OData.*`, ...) have no
 * module token, so they fall back to a plain de-dotted PascalCase name.
 *
 * Used with `definitions: { case: "preserve", name }` because @hey-api's
 * PascalCase/camelCase would otherwise lowercase the all-caps module token
 * (`OE` -> `Oe`).
 */
function cleanSchemaName(name: string): string {
	const pascalJoin = (value: string) => value
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join("")

	// Shorten a Sage model reference to `<Module><Model>`. Handles the common
	// `...Sage300.OE.WebApi.Models.Order` shape (module `OE`) and the
	// `...Sage300.Common.Models.Organization` shape (no `WebApi` segment).
	const shortenSage = (value: string): string | undefined => {
		const sage = /Sage\.CA\.SBS\.ERP\.Sage300\.([A-Za-z0-9]+)(?:\.WebApi)?\.Models\.([A-Za-z0-9.]+)/.exec(value)
		if (!sage) return undefined
		const [, moduleToken, model] = sage
		// 2-3 letter ledger codes (AR, IC, OE, ...) read best fully uppercased.
		const prefix = /^[A-Za-z]{2,3}$/.test(moduleToken) ? moduleToken.toUpperCase() : pascalJoin(moduleToken)
		return `${prefix}${pascalJoin(model)}`
	}

	// OData list envelope `ODataResponse[List[<inner>]]` -> `<Inner>ListResponse`.
	// @hey-api appends its read/write modifier (e.g. `Writable`) after the `]]`,
	// so capture it too: the request variant becomes `<Inner>ListResponseWritable`.
	const envelope = /ODataResponse\[System\.Collections\.Generic\.List\[(.+?)\]\](\w*)$/.exec(name)
	if (envelope) {
		const inner = shortenSage(envelope[1]) ?? pascalJoin(envelope[1])
		return `${inner}ListResponse${pascalJoin(envelope[2])}`
	}

	return shortenSage(name) ?? pascalJoin(name)
}

export default defineConfig([{
	input: {
		// path: "../backend/openapi.json",
		path: apiBaseUrl,
		// fetch: {
		// 	headers: {
		// 		Authorization: `Basic ${auth}`,
		// 	},
		// },
	},
	output: {
		path: "shared/sage300",
		postProcess: ["eslint"],
		header: [
			"// <AUTO_GENERATED> DO NOT EDIT THIS FILE DIRECTLY.",
			"// This file is auto-generated by @hey-api/openapi-ts",
		],
	},
	parser: {
		patch: {
			// Sage's operation ids bake in the shared `/v{apiVersion}/{tenant}/{company}`
			// prefix (e.g. `ARCustomers_GetByApiversionAndTenantAndCompany`). Override
			// them with concise names so SDK functions, types, and zod schemas stay short.
			operations: (method, path, operation) => {
				operation.operationId = buildOperationId(method, path, operation.tags?.[0])
			},
		},
		pagination: {
			keywords: [
				...defaultPaginationKeywords,
				"after_id",
				"after_created_at",
				"limit",
			],
		},
		filters: {
			tags: {
				include: ["ARCustomers", "ICItems", "ICCategories", "ICItemPricing", " OEOrders", "OEInvoices"],
			},
		},
	},
	plugins: [
		{
			name: "@hey-api/sdk",
			auth: true,
			client: "@hey-api/client-ofetch",
			transformer: "@hey-api/transformers",
			validator: {
				request: "zod",
			},
		},
		{
			name: "@hey-api/typescript",
			enums: "javascript",
			// Shorten model type names, e.g. `SageCaSbsErpSage300OeWebApiModelsOrder`
			// -> `OEOrder`. `preserve` keeps the uppercased module prefix intact.
			definitions: {
				case: "preserve",
				name: name => `${cleanSchemaName(name)}T`,
			},
		},
		{
			name: "@hey-api/transformers",
			dates: true,
			// just using zod's int64 support.
			// json cannot transport bigints as json number is 2^53. bigint is 2^63-1
			// bigint: true,
		},
		{
			name: "@hey-api/client-ofetch",
			throwOnError: true,
		},
		{
			"name": "zod",
			"compatibilityVersion": "mini",
			"exportFromIndex": true,
			// Keep zod model schema names in sync with the shortened types, e.g.
			// `zSageCaSbsErpSage300OeWebApiModelsOrder` -> `zOEOrder`.
			"definitions": {
				case: "preserve",
				name: name => `z${cleanSchemaName(name)}`,
			},
			"~resolvers": {
				string(ctx) {
					const { $, schema, symbols } = ctx
					const { z } = symbols
					if (schema.format === "int64") {
						return $(z)
							.attr("string")
							.call()
							.attr("refine")
							.call(
								$.func()
									.param("val")
									.do(
										$.try(
											$(z)
												.attr("int64")
												.call()
												.attr("parse")
												.call($("BigInt").call("val")),
											$.return($.literal(true)),
										).catch($.return($.literal(false))),
									),
								$.object().prop("message", $.literal("Must be a valid int64 string")),
							)
					}
				},
				// integer(ctx) {
				// 	const { $, symbols } = ctx
				// 	const { z } = symbols
				// 	if (ctx.schema.format === "int64") {
				// 		return $(z).attr("string").call().attr("refine").call(
				// 			$.func().param("val").do(
				// 				$.try(
				// 					$(z).attr("int64").call().attr("parse").call($("BigInt").call("val")),
				// 					$.return($.literal(true)),
				// 				).catch($.return($.literal(false))),
				// 			),
				// 			$.object().prop("message", $.literal("Must be a valid int64 string")),
				// 		)
				// 	}
				// },
			},
		},
	],
}])
