import { log } from "#shared/log"
import { client } from "#shared/sage300/client.gen"
// import { $fetch } from "ofetch"

export default defineNitroPlugin((nitroApp) => {
	const config = useRuntimeConfig()

	nitroApp.hooks.hookOnce("close", async () => {
		log.info("✓ Closing SMTP transporter...")
		client.setConfig({
			baseUrl: config.sage300.apiBaseURL as string,
			auth: config.sage300.auth,
			headers: {
				"Accept": "application/json",
				"Content-Type": "application/json",
			},
			credentials: "include",
			timeout: 30000, // 30 seconds
			async onRequest(context) {
				const { options } = context

				// The generated routes keep the shared `/v{apiVersion}/{tenant}/{company}`
				// prefix as path placeholders. By this point the URL is built and the
				// braces are percent-encoded (`%7B...%7D`), so fill them once here instead
				// of passing apiVersion/tenant/company on every SDK call. ofetch runs
				// onRequest before it resolves the final URL, so this takes effect.
				if (typeof context.request === "string" && context.request.includes("%7B")) {
					const { apiVersion, tenant, company } = config.sage300
					context.request = context.request
						.replace(/%7BapiVersion%7D/g, encodeURIComponent(apiVersion as string))
						.replace(/%7Btenant%7D/g, encodeURIComponent(tenant as string))
						.replace(/%7Bcompany%7D/g, encodeURIComponent(company as string))
				}

				log.debug(
					{ request: context.request, options },
					"[fetch] Sending request",
				)
			},
			onRequestError({ request, options, error }) {
				log.error(
					{ request, options, error },
					"[fetch] Request error",
				)
			},
			onResponse({ request, response }) {
				log.debug(
					{
						status: response.status,
						data: response._data,
					},
					`[fetch] Response received from ${request}`,
				)
			},
			onResponseError({ request, response }) {
				log.error(
					{
						request,
						status: response.status,
						statusText: response.statusText,
					},
					"[fetch] Response error",
				)
			},
		})
		log.info("✓ SMTP transporter closed")
	})

	log.debug("[fetch] openapi client initialized")

	return {}
	// Set the ofetch client instance in the generated OpenAPI client
	// client.setConfig({ ofetch: openApiClient })
})
