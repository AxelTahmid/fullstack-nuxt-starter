import { log } from "#shared/log"
import { client } from "#shared/sage300/client.gen"

export default defineNitroPlugin(() => {
	const config = useRuntimeConfig()
	const authHeader = config.sage300.auth
		? `Basic ${config.sage300.auth}`
		: undefined

	client.setConfig({
		baseUrl: config.sage300.apiBaseURL as string,
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json",
			...(authHeader ? { Authorization: authHeader } : {}),
		},
		credentials: "include",
		timeout: Number(config.sage300.timeout) || 30000,
		async onRequest(context) {
			const { options } = context

			// Some generated keyed routes use an uppercase `/V{apiVersion}` prefix.
			// The normal path serializer handles supplied params, and this fallback
			// keeps any still-encoded shared placeholders usable.
			if (typeof context.request === "string" && context.request.includes("%7B")) {
				const { apiVersion, tenant, company } = config.sage300
				context.request = context.request
					.replace(/%7BapiVersion%7D/g, encodeURIComponent(apiVersion as string))
					.replace(/%7Btenant%7D/g, encodeURIComponent(tenant as string))
					.replace(/%7Bcompany%7D/g, encodeURIComponent(company as string))
			}

			log.debug(
				{ request: context.request, options },
				"[sage300] Sending request",
			)
		},
		onRequestError({ request, options, error }) {
			log.error(
				{ request, options, error },
				"[sage300] Request error",
			)
		},
		onResponse({ request, response }) {
			log.debug(
				{
					status: response.status,
				},
				`[sage300] Response received from ${request}`,
			)
		},
		onResponseError({ request, response }) {
			log.error(
				{
					request,
					status: response.status,
					statusText: response.statusText,
				},
				"[sage300] Response error",
			)
		},
	})

	log.debug("[sage300] OpenAPI client initialized")

	return {}
})
