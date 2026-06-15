import { updateBrandSchema } from "#shared/schemas/brand"
import type { BrandSettings } from "#shared/types/brand"
import type { BrandSettingsUpdateRecord } from "~~/server/db/types"
import { brandRepo } from "~~/server/utils/db"
import { requireSessionUser } from "~~/server/utils/auth"

export default defineEventHandler(async (event): Promise<BrandSettings> => {
	const user = await requireSessionUser(event)

	if (user.role !== "admin") {
		throw createError({ statusCode: 403, statusMessage: "Admin access required" })
	}

	const body = await readValidatedBody(event, updateBrandSchema.parse)

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

	const record = await brandRepo.update(patch)

	return {
		orgName: record.org_name,
		tagline: record.tagline,
		logoDataUrl: record.logo_data_url,
		primaryColor: record.primary_color,
		sidebarColor: record.sidebar_color,
		accentColor: record.accent_color,
	}
})
