import tailwindcss from "@tailwindcss/vite"

export default defineNuxtConfig({
	modules: [
		"@nuxt/eslint",
		"@nuxtjs/html-validator",
		"@nuxtjs/device",
		"@pinia/nuxt",
		"@nuxtjs/color-mode",
		"shadcn-nuxt",
		"nuxt-auth-utils",
	],

	ssr: true,

	pages: {
		pattern: ["**/*.vue", "!**/_lib/**"],
	},

	imports: {
		scan: false,
	},

	devtools: {
		enabled: process.env.NODE_ENV !== "production",
	},

	app: {
		head: {
			htmlAttrs: {
				lang: "en",
			},
			charset: "utf-8",
			viewport: "width=device-width, initial-scale=1",
			title: "SupplyKey Industrial",
			titleTemplate: "%s · SupplyKey",
			link: [
				{ rel: "icon", type: "image/png", href: "/favicon.png" },
				{ rel: "shortcut icon", type: "image/png", href: "/favicon.png" },
				{ rel: "apple-touch-icon", href: "/favicon.png" },
				{ rel: "preconnect", href: "https://fonts.googleapis.com" },
				{ rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
				{
					rel: "stylesheet",
					href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap",
				},
			],
		},
	},

	css: ["~/assets/css/main.css"],

	colorMode: {
		classSuffix: "",
	},

	runtimeConfig: {
		session: {
			cookie: {
				secure: process.env.NUXT_SESSION_COOKIE_SECURE === "true",
				sameSite: "lax",
			},
		},
		public: {
			appName: process.env.NUXT_PUBLIC_APP_NAME || "SupplyKey Industrial",
			baseURL: process.env.NUXT_PUBLIC_BASE_URL || "http://localhost:3000",
			demoMode: process.env.DEMO_MODE === "true",
		},
		sage300: {
			// ! MUST REMOVE BASIC AUTH IN PRODUCTION.
			username: process.env.SAGE300_USERNAME || "DEV",
			password: process.env.SAGE300_PASSWORD,
			auth: process.env.SAGE300_USERNAME && process.env.SAGE300_PASSWORD
				? Buffer.from(`${process.env.SAGE300_USERNAME}:${process.env.SAGE300_PASSWORD}`).toString("base64")
				: "",
			apiBaseURL: process.env.SAGE300_API_BASE_URL || "http://192.168.0.5/Sage300WebApi",
			apiVersion: process.env.SAGE300_API_VERSION || "1.0",
			tenant: process.env.SAGE300_TENANT || "-",
			company: process.env.SAGE300_COMPANY || "CMSTST",
			currencyCode: process.env.SAGE300_CURRENCY_CODE || "CAD",
			priceListCode: process.env.SAGE300_PRICE_LIST_CODE || "",
			timeout: process.env.SAGE300_TIMEOUT ? Number.parseInt(process.env.SAGE300_TIMEOUT, 10) : 30000,
		},
		auth: {
			magicLinkTtlMinutes: process.env.AUTH_MAGIC_LINK_TTL_MINUTES
				? Number.parseInt(process.env.AUTH_MAGIC_LINK_TTL_MINUTES, 10)
				: 20,
		},
		db: {
			host: process.env.DB_HOST,
			port: process.env.DB_PORT ? Number.parseInt(process.env.DB_PORT, 10) : 5432,
			user: process.env.DB_USER,
			password: process.env.DB_PASSWORD,
			name: process.env.DB_NAME,
			ssl: process.env.DB_SSL === "true",
		},
		mail: {
			isProduction: process.env.NODE_ENV === "production",
			host: process.env.SMTP_HOST || (process.env.NODE_ENV === "production" ? "" : "localhost"),
			port: process.env.SMTP_PORT ? Number.parseInt(process.env.SMTP_PORT, 10) : 1025,
			secure: process.env.SMTP_SECURE === "true",
			user: process.env.SMTP_USER,
			password: process.env.SMTP_PASS,
			from: process.env.MAILER_DEFAULT_FROM || "SupplyKey <noreply@supplykey.local>",
			replyTo: process.env.MAILER_DEFAULT_REPLY_TO || "",
			priority: process.env.MAILER_DEFAULT_PRIORITY || "normal",
			pool: process.env.SMTP_POOL === "true",
			maxConnections: process.env.SMTP_MAX_CONNECTIONS
				? Number.parseInt(process.env.SMTP_MAX_CONNECTIONS, 10)
				: 5,
			maxMessages: process.env.SMTP_MAX_MESSAGES
				? Number.parseInt(process.env.SMTP_MAX_MESSAGES, 10)
				: 100,
			tlsRejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED
				? process.env.SMTP_TLS_REJECT_UNAUTHORIZED === "true"
				: process.env.NODE_ENV === "production",
			connectionTimeout: process.env.SMTP_CONNECTION_TIMEOUT
				? Number.parseInt(process.env.SMTP_CONNECTION_TIMEOUT, 10)
				: 120_000,
			socketTimeout: process.env.SMTP_SOCKET_TIMEOUT
				? Number.parseInt(process.env.SMTP_SOCKET_TIMEOUT, 10)
				: 600_000,
		},
		pgboss: {
			host: process.env.DB_HOST,
			port: process.env.DB_PORT ? Number.parseInt(process.env.DB_PORT, 10) : 5432,
			user: process.env.DB_USER,
			password: process.env.DB_PASSWORD,
			database: process.env.DB_NAME,
			ssl: process.env.DB_SSL || "false",
			application_name: process.env.PGBOSS_APP_NAME || "fullstack_starter_queue",
			schema: process.env.PGBOSS_SCHEMA || "queue",
			migrate: process.env.PGBOSS_MIGRATE !== "false",
			max: process.env.PGBOSS_MAX_CONN ? Number.parseInt(process.env.PGBOSS_MAX_CONN, 10) : 10,
		},
		minio: {
			// Server-side host (Docker overrides to `minio`); used for bucket ops + deletes.
			endpoint: process.env.MINIO_ENDPOINT || "localhost",
			port: process.env.MINIO_PORT ? Number.parseInt(process.env.MINIO_PORT, 10) : 9000,
			useSSL: process.env.MINIO_USE_SSL === "true",
			// Explicit region so the client signs without a network region lookup.
			region: process.env.MINIO_REGION || "us-east-1",
			accessKey: process.env.MINIO_ACCESS_KEY || "",
			secretKey: process.env.MINIO_SECRET_KEY || "",
			bucket: process.env.MINIO_BUCKET || "product-images",
			// Browser-facing base URL: presigned uploads + public image URLs.
			publicUrl: process.env.MINIO_PUBLIC_URL || "http://localhost:9000",
		},
	},

	dir: {
		shared: "shared",
	},

	compatibilityDate: "2026-01-31",

	nitro: {
		compressPublicAssets: {
			gzip: true,
			brotli: true,
		},
		// typescript: {
		// 	tsConfig: { compilerOptions: { composite: true } },
		// },
	},

	vite: {
		plugins: [tailwindcss() as never],
	},

	typescript: {
		typeCheck: false,
		// tsConfig: { compilerOptions: { composite: true } },
		// sharedTsConfig: { compilerOptions: { composite: true } },
		// nodeTsConfig: { compilerOptions: { composite: true } },
	},

	debug: process.env.NODE_ENV !== "production",

	eslint: {
		config: {
			stylistic: {
				indent: "tab",
				quotes: "double",
				semi: false,
			},
		},
	},

	shadcn: {
		prefix: "",
		componentDir: "./app/components/ui",
	},
})
