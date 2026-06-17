/**
 * Brand theme generation.
 *
 * Brand settings store a small set of hex "seeds" (primary, accent, sidebar,
 * surface) plus a radius. From the seeds we generate the full light + dark
 * token palette that `app/plugins/brand.ts` injects as `:root` / `.dark`
 * overrides. Status (`--success/--warning/--error/--destructive`) and charts
 * 2-5 are intentionally left out — they stay semantic and use the `main.css`
 * defaults.
 *
 * Values are stored and emitted as hex. Generation uses OKLCH math internally
 * only to build perceptually even lightness ramps; nothing oklch is persisted.
 */

/** CSS variables the brand owns. Order is not significant. */
export const THEME_TOKENS = [
	"--background",
	"--foreground",
	"--card",
	"--card-foreground",
	"--popover",
	"--popover-foreground",
	"--primary",
	"--primary-foreground",
	"--secondary",
	"--secondary-foreground",
	"--muted",
	"--muted-foreground",
	"--accent",
	"--accent-foreground",
	"--border",
	"--input",
	"--ring",
	"--chart-1",
	"--sidebar",
	"--sidebar-foreground",
	"--sidebar-primary",
	"--sidebar-primary-foreground",
	"--sidebar-accent",
	"--sidebar-accent-foreground",
	"--sidebar-border",
	"--sidebar-ring",
] as const

export type ThemeToken = (typeof THEME_TOKENS)[number]

/** Map of `--token` -> hex value. */
export type TokenSet = Record<string, string>

export interface Theme {
	light: TokenSet
	dark: TokenSet
}

export interface ThemeSeeds {
	/** Brand primary (actions, active emphasis). */
	primary: string
	/** Accent surface tint. */
	accent: string
	/** Sidebar base. */
	sidebar: string
	/** Neutral base for page/card/muted/border surfaces. */
	surface: string
}

// --- color math (internal; inputs and outputs are hex) ------------------------

interface Oklch {
	L: number // 0..1
	C: number
	H: number // degrees
}

function clamp01(n: number): number {
	return n < 0 ? 0 : n > 1 ? 1 : n
}

function srgbToLinear(c: number): number {
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(c: number): number {
	return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055
}

function hexToOklch(hex: string): Oklch {
	const n = hex.replace("#", "")
	const r = srgbToLinear(Number.parseInt(n.slice(0, 2), 16) / 255)
	const g = srgbToLinear(Number.parseInt(n.slice(2, 4), 16) / 255)
	const b = srgbToLinear(Number.parseInt(n.slice(4, 6), 16) / 255)

	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

	const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
	const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
	const bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s

	let H = (Math.atan2(bb, a) * 180) / Math.PI
	if (H < 0)
		H += 360
	return { L, C: Math.hypot(a, bb), H }
}

function oklchToHex({ L, C, H }: Oklch): string {
	const hr = (H * Math.PI) / 180
	const a = C * Math.cos(hr)
	const b = C * Math.sin(hr)

	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
	const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3

	const r = linearToSrgb(clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s))
	const g = linearToSrgb(clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s))
	const bl = linearToSrgb(clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s))

	const toHex = (c: number) => Math.round(clamp01(c) * 255).toString(16).padStart(2, "0")
	return `#${toHex(r)}${toHex(g)}${toHex(bl)}`
}

/** A readable foreground for a given background hex. */
export function readableForeground(hex: string): string {
	const { L, C, H } = hexToOklch(hex)
	return L >= 0.6
		? oklchToHex({ L: 0.2, C: Math.min(C, 0.05), H }) // dark text on a light surface
		: oklchToHex({ L: 0.99, C: Math.min(C, 0.02), H }) // light text on a dark surface
}

// --- generation ---------------------------------------------------------------

/**
 * Generate the full light + dark palette from the four color seeds. Produces a
 * coherent, contrast-aware result; it is not expected to byte-match the
 * hand-tuned defaults (those are stored verbatim and only replaced when a seed
 * is edited — see `DEFAULT_THEME`).
 */
export function generateTheme(seeds: ThemeSeeds): Theme {
	const { primary, accent, sidebar, surface } = seeds
	const pr = hexToOklch(primary)
	const ac = hexToOklch(accent)
	const sb = hexToOklch(sidebar)
	const sf = hexToOklch(surface)

	const nH = sf.H
	const nC = Math.min(sf.C, 0.02) // keep neutrals quiet

	const primaryDark = oklchToHex({ L: 0.72, C: Math.min(pr.C, 0.085), H: pr.H })
	const primaryDarkFg = oklchToHex({ L: 0.22, C: Math.min(pr.C, 0.06), H: pr.H })
	const surfaceCard = oklchToHex({ L: Math.min(0.995, sf.L + 0.015), C: nC * 0.4, H: nH })
	const lightFg = oklchToHex({ L: 0.225, C: Math.min(nC, 0.008), H: nH })
	const darkFg = oklchToHex({ L: 0.94, C: Math.min(nC, 0.012), H: nH })

	const light: TokenSet = {
		"--background": surface,
		"--foreground": lightFg,
		"--card": surfaceCard,
		"--card-foreground": lightFg,
		"--popover": surfaceCard,
		"--popover-foreground": lightFg,
		"--primary": primary,
		"--primary-foreground": readableForeground(primary),
		"--secondary": oklchToHex({ L: sf.L - 0.04, C: nC, H: nH }),
		"--secondary-foreground": oklchToHex({ L: 0.4, C: Math.min(nC, 0.015), H: nH }),
		"--muted": oklchToHex({ L: sf.L - 0.018, C: nC, H: nH }),
		"--muted-foreground": oklchToHex({ L: 0.47, C: Math.min(nC, 0.015), H: nH }),
		"--accent": oklchToHex({ L: 0.93, C: Math.min(ac.C * 0.35, 0.03), H: ac.H }),
		"--accent-foreground": oklchToHex({ L: 0.24, C: Math.min(ac.C * 0.5, 0.03), H: ac.H }),
		"--border": oklchToHex({ L: sf.L - 0.155, C: nC, H: nH }),
		"--input": oklchToHex({ L: sf.L - 0.07, C: nC, H: nH }),
		"--ring": primary,
		"--chart-1": primary,
		"--sidebar": sidebar,
		"--sidebar-foreground": oklchToHex({ L: 0.91, C: Math.min(sb.C, 0.035), H: sb.H }),
		"--sidebar-primary": primary,
		"--sidebar-primary-foreground": readableForeground(primary),
		"--sidebar-accent": oklchToHex({ L: Math.min(0.4, sb.L + 0.07), C: sb.C, H: sb.H }),
		"--sidebar-accent-foreground": oklchToHex({ L: 0.97, C: 0.01, H: sb.H }),
		"--sidebar-border": oklchToHex({ L: Math.min(0.45, sb.L + 0.11), C: sb.C, H: sb.H }),
		"--sidebar-ring": oklchToHex({ L: 0.82, C: Math.min(pr.C, 0.08), H: pr.H }),
	}

	const dark: TokenSet = {
		"--background": oklchToHex({ L: 0.135, C: Math.min(nC, 0.016), H: nH }),
		"--foreground": darkFg,
		"--card": oklchToHex({ L: 0.175, C: Math.min(nC, 0.018), H: nH }),
		"--card-foreground": darkFg,
		"--popover": oklchToHex({ L: 0.175, C: Math.min(nC, 0.018), H: nH }),
		"--popover-foreground": darkFg,
		"--primary": primaryDark,
		"--primary-foreground": primaryDarkFg,
		"--secondary": oklchToHex({ L: 0.21, C: Math.min(nC, 0.025), H: nH }),
		"--secondary-foreground": oklchToHex({ L: 0.83, C: Math.min(nC, 0.015), H: nH }),
		"--muted": oklchToHex({ L: 0.2, C: Math.min(nC, 0.024), H: nH }),
		"--muted-foreground": oklchToHex({ L: 0.66, C: Math.min(nC, 0.02), H: nH }),
		"--accent": oklchToHex({ L: 0.26, C: Math.min(ac.C * 0.4, 0.025), H: ac.H }),
		"--accent-foreground": oklchToHex({ L: 0.94, C: 0.011, H: ac.H }),
		"--border": oklchToHex({ L: 0.28, C: Math.min(nC, 0.03), H: nH }),
		"--input": oklchToHex({ L: 0.21, C: Math.min(nC, 0.025), H: nH }),
		"--ring": primaryDark,
		"--chart-1": primaryDark,
		"--sidebar": oklchToHex({ L: Math.max(0.1, sb.L - 0.05), C: sb.C, H: sb.H }),
		"--sidebar-foreground": oklchToHex({ L: 0.91, C: Math.min(sb.C, 0.035), H: sb.H }),
		"--sidebar-primary": primaryDark,
		"--sidebar-primary-foreground": primaryDarkFg,
		"--sidebar-accent": oklchToHex({ L: Math.max(0.13, sb.L - 0.02), C: sb.C, H: sb.H }),
		"--sidebar-accent-foreground": oklchToHex({ L: 0.94, C: 0.011, H: sb.H }),
		"--sidebar-border": oklchToHex({ L: Math.min(0.3, sb.L + 0.07), C: sb.C, H: sb.H }),
		"--sidebar-ring": primaryDark,
	}

	return { light, dark }
}

/**
 * The hand-tuned palette shipped in `app/assets/css/main.css`. This is the
 * canonical default: it is stored verbatim on the brand row so the app looks
 * identical until an admin edits a seed, and it backs "reset to default".
 *
 * Keep in sync with `main.css` (CSS is the source of truth; update it first).
 */
export const DEFAULT_THEME: Theme = {
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

/** The seed values that correspond to `DEFAULT_THEME` (the shipped brand row). */
export const DEFAULT_SEEDS: ThemeSeeds = {
	primary: "#003f63",
	accent: "#5d3002",
	sidebar: "#0b1a26",
	surface: "#f9f9fd",
}

export const DEFAULT_RADIUS = "0.375rem"

/** True when seeds match the shipped defaults (case-insensitive hex compare). */
export function isDefaultSeeds(seeds: ThemeSeeds): boolean {
	return (Object.keys(DEFAULT_SEEDS) as (keyof ThemeSeeds)[])
		.every(key => seeds[key].toLowerCase() === DEFAULT_SEEDS[key].toLowerCase())
}

/**
 * Resolve seeds to a full palette. Default seeds return the exact hand-tuned
 * `DEFAULT_THEME`; anything else is generated. Used by both the API (what gets
 * stored) and the settings preview (what the admin sees) so they always agree.
 */
export function resolveTheme(seeds: ThemeSeeds): Theme {
	return isDefaultSeeds(seeds) ? DEFAULT_THEME : generateTheme(seeds)
}
