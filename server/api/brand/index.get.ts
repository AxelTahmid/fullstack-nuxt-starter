import { brandRepo } from "~~/server/utils/db"
import type { BrandSettings } from "#shared/types/brand"
import type { Theme } from "#shared/utils/theme"

export default defineEventHandler(async (): Promise<BrandSettings> => {
	const record = await brandRepo.get()

	return {
		orgName: record.org_name,
		tagline: record.tagline,
		logoDataUrl: record.logo_data_url,
		primaryColor: record.primary_color,
		sidebarColor: record.sidebar_color,
		accentColor: record.accent_color,
		surfaceColor: record.surface_color,
		radius: record.radius,
		theme: record.theme as unknown as Theme,
	}
})
