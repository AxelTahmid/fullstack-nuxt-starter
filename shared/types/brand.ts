import type { Theme } from "../utils/theme"

export interface BrandSettings {
	orgName: string
	tagline: string
	logoDataUrl: string | null
	/** Brand primary seed. */
	primaryColor: string
	/** Sidebar base seed. */
	sidebarColor: string
	/** Accent seed. */
	accentColor: string
	/** Neutral base seed for page/card/muted/border surfaces. */
	surfaceColor: string
	/** Base radius token, e.g. "0.375rem". */
	radius: string
	/** Generated full light + dark palette, injected by the brand plugin. */
	theme: Theme
}

/** Admin-editable brand fields — everything except the generated palette. */
export type BrandEditable = Omit<BrandSettings, "theme">
