import { brandRepo } from "~~/server/utils/db"
import { requireAdmin } from "~~/server/utils/auth"
import { updateBrandSchema } from "#shared/schemas/brand"
import type { BrandSettings } from "#shared/types/brand"
import { resolveTheme, type Theme } from "#shared/utils/theme"
import type { BrandSettingsUpdateRecord } from "~~/server/db/repository/brand"

export default defineEventHandler(async (event): Promise<BrandSettings> => {
	await requireAdmin(event)
	const body = await readValidatedBody(event, updateBrandSchema.parse)
	const current = await brandRepo.get()

	const patch: BrandSettingsUpdateRecord = {}
	if (body.orgName !== undefined)
		patch.org_name = body.orgName
	if (body.tagline !== undefined)
		patch.tagline = body.tagline
	if (body.logoDataUrl !== undefined)
		patch.logo_data_url = body.logoDataUrl
	if (body.primaryColor !== undefined)
		patch.primary_color = body.primaryColor
	if (body.sidebarColor !== undefined)
		patch.sidebar_color = body.sidebarColor
	if (body.accentColor !== undefined)
		patch.accent_color = body.accentColor
	if (body.surfaceColor !== undefined)
		patch.surface_color = body.surfaceColor
	if (body.radius !== undefined)
		patch.radius = body.radius

	// Regenerate the full palette only when a color seed changes. Identity-only
	// edits (name/tagline/logo) and radius keep the stored palette untouched, so
	// the hand-tuned default survives until a color is actually edited.
	const seedChanged = body.primaryColor !== undefined
		|| body.accentColor !== undefined
		|| body.sidebarColor !== undefined
		|| body.surfaceColor !== undefined
	if (seedChanged) {
		patch.theme = resolveTheme({
			primary: body.primaryColor ?? current.primary_color,
			accent: body.accentColor ?? current.accent_color,
			sidebar: body.sidebarColor ?? current.sidebar_color,
			surface: body.surfaceColor ?? current.surface_color,
		}) as unknown as BrandSettingsUpdateRecord["theme"]
	}

	const record = await brandRepo.update(patch)

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
