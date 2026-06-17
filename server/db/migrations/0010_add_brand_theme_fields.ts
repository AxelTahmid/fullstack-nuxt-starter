import { sql, type Kysely } from "kysely"

// Frozen snapshot of the shipped `main.css` palette (light + dark). Backfilled
// onto the existing singleton row so the app looks identical until an admin
// edits a brand seed. The runtime copy lives in `shared/utils/theme.ts`.
const DEFAULT_THEME = {
	light: {
		"--background": "#f9f9fd",
		"--foreground": "#1a1c1e",
		"--card": "#ffffff",
		"--card-foreground": "#1a1c1e",
		"--popover": "#ffffff",
		"--popover-foreground": "#1a1c1e",
		"--primary": "#003f63",
		"--primary-foreground": "#ffffff",
		"--secondary": "#edeef1",
		"--secondary-foreground": "#42474e",
		"--muted": "#f3f3f7",
		"--muted-foreground": "#42474e",
		"--accent": "#e8e8eb",
		"--accent-foreground": "#1a1c1e",
		"--border": "#c1c7cf",
		"--input": "#e2e2e6",
		"--ring": "#003f63",
		"--chart-1": "#003f63",
		"--sidebar": "#0b1a26",
		"--sidebar-foreground": "#d3e4f8",
		"--sidebar-primary": "#003f63",
		"--sidebar-primary-foreground": "#ffffff",
		"--sidebar-accent": "#152a3d",
		"--sidebar-accent-foreground": "#ffffff",
		"--sidebar-border": "#1a3550",
		"--sidebar-ring": "#9dcbf6",
	},
	dark: {
		"--background": "#0b1218",
		"--foreground": "#e6edf3",
		"--card": "#11191f",
		"--card-foreground": "#e6edf3",
		"--popover": "#11191f",
		"--popover-foreground": "#e6edf3",
		"--primary": "#7dabd4",
		"--primary-foreground": "#001d32",
		"--secondary": "#1a2630",
		"--secondary-foreground": "#c1c7cf",
		"--muted": "#16202a",
		"--muted-foreground": "#8a939d",
		"--accent": "#1a2630",
		"--accent-foreground": "#e6edf3",
		"--border": "#223040",
		"--input": "#1a2630",
		"--ring": "#7dabd4",
		"--chart-1": "#7dabd4",
		"--sidebar": "#070e14",
		"--sidebar-foreground": "#d3e4f8",
		"--sidebar-primary": "#7dabd4",
		"--sidebar-primary-foreground": "#001d32",
		"--sidebar-accent": "#0f1c27",
		"--sidebar-accent-foreground": "#e6edf3",
		"--sidebar-border": "#152436",
		"--sidebar-ring": "#7dabd4",
	},
}

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("brand_settings")
		.addColumn("surface_color", "text", col => col.notNull().defaultTo("#f9f9fd"))
		.addColumn("radius", "text", col => col.notNull().defaultTo("0.375rem"))
		.addColumn("theme", "jsonb")
		.execute()

	// Backfill the resolved palette onto the singleton row, then lock it down.
	await sql`
		UPDATE brand_settings
		SET theme = ${JSON.stringify(DEFAULT_THEME)}::jsonb
		WHERE theme IS NULL
	`.execute(db)

	await db.schema
		.alterTable("brand_settings")
		.alterColumn("theme", col => col.setNotNull())
		.execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("brand_settings")
		.dropColumn("theme")
		.dropColumn("radius")
		.dropColumn("surface_color")
		.execute()
}
