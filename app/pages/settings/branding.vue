<script setup lang="ts">
import { ArrowLeft, CheckCircle2, LoaderCircle, RotateCcw, Upload } from "@lucide/vue"
import type { FetchError } from "ofetch"
import type { BrandSettings } from "#shared/types/brand"
import { DEFAULT_RADIUS, DEFAULT_SEEDS, DEFAULT_THEME, resolveTheme } from "#shared/utils/theme"
import { toast } from "~/components/toast"
import { useBrand } from "~/composables/useBrand"

definePageMeta({
	layout: "dashboard",
	middleware: ["authenticated", "admin"],
})

useHead({
	title: "Branding",
})

const { brand, refresh, update } = useBrand()
if (!brand.value)
	await refresh()

const defaults: BrandSettings = {
	orgName: "SupplyKey",
	tagline: "Mine Supply Company",
	logoDataUrl: null,
	primaryColor: DEFAULT_SEEDS.primary,
	sidebarColor: DEFAULT_SEEDS.sidebar,
	accentColor: DEFAULT_SEEDS.accent,
	surfaceColor: DEFAULT_SEEDS.surface,
	radius: DEFAULT_RADIUS,
	theme: DEFAULT_THEME,
}

const form = reactive<BrandSettings>({
	orgName: brand.value?.orgName ?? defaults.orgName,
	tagline: brand.value?.tagline ?? defaults.tagline,
	logoDataUrl: brand.value?.logoDataUrl ?? null,
	primaryColor: brand.value?.primaryColor ?? defaults.primaryColor,
	sidebarColor: brand.value?.sidebarColor ?? defaults.sidebarColor,
	accentColor: brand.value?.accentColor ?? defaults.accentColor,
	surfaceColor: brand.value?.surfaceColor ?? defaults.surfaceColor,
	radius: brand.value?.radius ?? defaults.radius,
	theme: brand.value?.theme ?? defaults.theme,
})

watch(brand, (next) => {
	if (!next)
		return
	form.orgName = next.orgName
	form.tagline = next.tagline
	form.logoDataUrl = next.logoDataUrl
	form.primaryColor = next.primaryColor
	form.sidebarColor = next.sidebarColor
	form.accentColor = next.accentColor
	form.surfaceColor = next.surfaceColor
	form.radius = next.radius
	form.theme = next.theme
})

const colorFields = [
	{ key: "primaryColor", label: "Primary", hint: "CTAs, active navigation, links, chart accents" },
	{ key: "sidebarColor", label: "Sidebar", hint: "Left navigation shell background" },
	{ key: "surfaceColor", label: "Surface", hint: "Page, card, and panel base — shifts the whole palette" },
	{ key: "accentColor", label: "Accent", hint: "Subtle highlighted surfaces" },
] as const

const radiusOptions = [
	{ label: "None", value: "0rem" },
	{ label: "S", value: "0.25rem" },
	{ label: "M", value: "0.375rem" },
	{ label: "L", value: "0.5rem" },
	{ label: "XL", value: "0.75rem" },
]

const presets: { name: string, seeds: Pick<BrandSettings, "primaryColor" | "sidebarColor" | "accentColor" | "surfaceColor" | "radius"> }[] = [
	{ name: "SupplyKey", seeds: { primaryColor: "#003f63", sidebarColor: "#0b1a26", accentColor: "#5d3002", surfaceColor: "#f9f9fd", radius: "0.375rem" } },
	{ name: "Forest", seeds: { primaryColor: "#1f7a3d", sidebarColor: "#10241a", accentColor: "#b8860b", surfaceColor: "#f6faf7", radius: "0.5rem" } },
	{ name: "Slate", seeds: { primaryColor: "#334155", sidebarColor: "#0f172a", accentColor: "#d97706", surfaceColor: "#f8fafc", radius: "0.25rem" } },
	{ name: "Crimson", seeds: { primaryColor: "#9f1239", sidebarColor: "#1c0a10", accentColor: "#0f766e", surfaceColor: "#fdf6f7", radius: "0.5rem" } },
]

function applyPreset(seeds: typeof presets[number]["seeds"]) {
	Object.assign(form, seeds)
}

const fileInput = useTemplateRef<{ click: () => void }>("fileInput")
const isSaving = ref(false)

function triggerFilePick() {
	fileInput.value?.click()
}

function onFileSelected(event: Event) {
	const input = event.target as HTMLInputElement
	const file = input.files?.[0]
	if (!file)
		return

	if (file.size > 300_000) {
		toast.error("Logo file must be smaller than 300 KB.")
		input.value = ""
		return
	}

	const reader = new FileReader()
	reader.onload = () => {
		form.logoDataUrl = typeof reader.result === "string" ? reader.result : null
	}
	reader.onerror = () => {
		toast.error("Could not read logo file.")
	}
	reader.readAsDataURL(file)
	input.value = ""
}

function clearLogo() {
	form.logoDataUrl = null
}

function resetForm() {
	Object.assign(form, defaults)
}

async function save() {
	isSaving.value = true
	try {
		await update({
			orgName: form.orgName,
			tagline: form.tagline,
			logoDataUrl: form.logoDataUrl,
			primaryColor: form.primaryColor,
			sidebarColor: form.sidebarColor,
			accentColor: form.accentColor,
			surfaceColor: form.surfaceColor,
			radius: form.radius,
		})
		toast.success("Brand updated. Theme propagating…")
	}
	catch (err) {
		const fetchError = err as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to save branding.")
	}
	finally {
		isSaving.value = false
	}
}

// Resolve seeds to the full palette the same way the API does, so the preview
// matches exactly what will be saved. Tokens are applied as scoped CSS
// variables; the preview markup then uses ordinary token utilities.
const previewTheme = computed(() => resolveTheme({
	primary: form.primaryColor,
	accent: form.accentColor,
	sidebar: form.sidebarColor,
	surface: form.surfaceColor,
}))

const previews = computed(() => [
	{ label: "Light", vars: { ...previewTheme.value.light, "--radius": form.radius } },
	{ label: "Dark", vars: { ...previewTheme.value.dark, "--radius": form.radius } },
])
</script>

<template>
	<div class="space-y-8">
		<NuxtLink
			to="/dashboard"
			class="text-muted-foreground hover:text-primary inline-flex items-center gap-2 text-[0.68rem] font-bold tracking-[0.16em] uppercase transition-colors"
		>
			<ArrowLeft class="size-3.5" />
			Back to Dashboard
		</NuxtLink>

		<section class="space-y-2">
			<p class="text-muted-foreground text-[0.68rem] font-bold tracking-[0.24em] uppercase">
				Platform Settings
			</p>

			<h1
				class="text-foreground text-5xl font-extrabold tracking-[-0.045em]"
				style="font-family: var(--font-display);"
			>
				Branding
			</h1>

			<p class="text-muted-foreground max-w-2xl text-sm leading-7">
				Set the organization identity and the four color seeds. The full light and dark palette is generated from the seeds and applied across every screen immediately for all active sessions. Status colors (success, warning, error) stay fixed.
			</p>
		</section>

		<section class="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
			<div class="space-y-5">
				<div class="border-border/60 bg-card rounded-md border p-6">
					<h2
						class="text-foreground mb-5 text-lg font-extrabold tracking-[-0.015em]"
						style="font-family: var(--font-display);"
					>
						Identity
					</h2>

					<div class="space-y-5">
						<div>
							<Label class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.18em] uppercase">
								Organization Name
							</Label>

							<Input
								v-model="form.orgName"
								type="text"
								class="bg-muted text-foreground focus:ring-primary/40 mt-2 w-full rounded-md px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
							/>
						</div>

						<div>
							<Label class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.18em] uppercase">
								Tagline
							</Label>

							<Input
								v-model="form.tagline"
								type="text"
								class="bg-muted text-foreground focus:ring-primary/40 mt-2 w-full rounded-md px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
							/>
						</div>

						<div>
							<Label class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.18em] uppercase">
								Logo
							</Label>

							<div class="bg-muted mt-2 flex items-center gap-4 rounded-md p-4">
								<div class="bg-card flex size-24 shrink-0 items-center justify-center rounded-md">
									<img
										v-if="form.logoDataUrl"
										:src="form.logoDataUrl"
										alt="Logo preview"
										class="max-h-20 max-w-20 object-contain"
									>

									<span
										v-else
										class="text-muted-foreground text-[0.58rem] font-bold tracking-[0.14em] uppercase"
									>
										No logo
									</span>
								</div>

								<div class="flex-1 space-y-2">
									<div class="flex gap-2">
										<Button
											type="button"
											class="border-border/70 bg-card text-foreground hover:border-primary hover:text-primary inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[0.62rem] font-bold tracking-[0.14em] uppercase transition-all"
											@click="triggerFilePick"
										>
											<Upload class="size-3.5" />
											Upload
										</Button>

										<Button
											v-if="form.logoDataUrl"
											type="button"
											class="border-border/70 text-muted-foreground hover:border-destructive hover:text-destructive inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[0.62rem] font-bold tracking-[0.14em] uppercase transition-all"
											@click="clearLogo"
										>
											Remove
										</Button>
									</div>

									<p class="text-muted-foreground text-[0.62rem]">
										SVG or PNG. Under 300 KB. Encoded as a data URL.
									</p>
								</div>

								<Input
									ref="fileInput"
									type="file"
									accept="image/svg+xml,image/png,image/jpeg,image/webp"
									class="hidden"
									@change="onFileSelected"
								/>
							</div>
						</div>
					</div>
				</div>

				<div class="border-border/60 bg-card rounded-md border p-6">
					<h2
						class="text-foreground mb-5 text-lg font-extrabold tracking-[-0.015em]"
						style="font-family: var(--font-display);"
					>
						Color Scheme
					</h2>

					<div class="mb-5">
						<p class="text-muted-foreground mb-2 text-[0.62rem] font-bold tracking-[0.18em] uppercase">
							Presets
						</p>

						<div class="flex flex-wrap gap-2">
							<Button
								v-for="preset in presets"
								:key="preset.name"
								type="button"
								class="border-border/70 text-foreground hover:border-primary hover:text-primary inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[0.62rem] font-bold tracking-[0.12em] uppercase transition-all"
								@click="applyPreset(preset.seeds)"
							>
								<span class="flex -space-x-1">
									<span
										class="border-card size-3 rounded-full border"
										:style="{ backgroundColor: preset.seeds.primaryColor }"
									/>

									<span
										class="border-card size-3 rounded-full border"
										:style="{ backgroundColor: preset.seeds.sidebarColor }"
									/>

									<span
										class="border-card size-3 rounded-full border"
										:style="{ backgroundColor: preset.seeds.accentColor }"
									/>
								</span>
								{{ preset.name }}
							</Button>
						</div>
					</div>

					<div class="space-y-4">
						<div
							v-for="field in colorFields"
							:key="field.key"
							class="bg-muted flex items-center gap-4 rounded-md p-4"
						>
							<Input
								v-model="form[field.key]"
								type="color"
								:aria-label="`${field.label} color`"
								class="border-border/50 size-14 cursor-pointer rounded-md border bg-transparent"
							/>

							<div class="flex-1">
								<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.18em] uppercase">
									{{ field.label }}
								</p>

								<p class="text-foreground mt-1 font-mono text-sm font-semibold">
									{{ form[field.key] }}
								</p>

								<p class="text-muted-foreground text-[0.62rem]">
									{{ field.hint }}
								</p>
							</div>
						</div>

						<div class="bg-muted flex flex-wrap items-center justify-between gap-3 rounded-md p-4">
							<div>
								<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.18em] uppercase">
									Corner Radius
								</p>

								<p class="text-muted-foreground mt-1 text-[0.62rem]">
									Roundness of cards, inputs, and buttons
								</p>
							</div>

							<div class="border-border/60 bg-card inline-flex rounded-md border p-0.5">
								<Button
									v-for="option in radiusOptions"
									:key="option.value"
									type="button"
									class="rounded-sm px-3 py-1.5 text-[0.62rem] font-bold tracking-[0.12em] uppercase transition-all"
									:class="form.radius === option.value
										? 'bg-primary text-primary-foreground'
										: 'text-muted-foreground hover:text-foreground'"
									@click="form.radius = option.value"
								>
									{{ option.label }}
								</Button>
							</div>
						</div>
					</div>
				</div>

				<div class="flex items-center justify-end gap-3">
					<Button
						type="button"
						class="border-border/70 text-muted-foreground hover:border-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md border px-4 py-2.5 text-[0.62rem] font-bold tracking-[0.14em] uppercase transition-all"
						:disabled="isSaving"
						@click="resetForm"
					>
						<RotateCcw class="size-3.5" />
						Reset to defaults
					</Button>

					<Button
						type="button"
						class="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[0.62rem] font-bold tracking-[0.14em] uppercase transition-all hover:brightness-110 disabled:opacity-60"
						:disabled="isSaving"
						@click="save"
					>
						<LoaderCircle
							v-if="isSaving"
							class="size-3.5 animate-spin"
						/>

						<CheckCircle2
							v-else
							class="size-3.5"
						/>
						{{ isSaving ? "Saving…" : "Save Branding" }}
					</Button>
				</div>
			</div>

			<aside class="space-y-3 xl:sticky xl:top-24 xl:self-start">
				<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
					Live Preview
				</p>

				<div
					v-for="preview in previews"
					:key="preview.label"
					:style="preview.vars"
					class="bg-background border-border overflow-hidden rounded-lg border"
				>
					<div class="bg-sidebar text-sidebar-foreground flex items-center gap-3 p-4">
						<div class="bg-sidebar-primary text-sidebar-primary-foreground flex size-9 items-center justify-center rounded-md text-[0.68rem] font-extrabold">
							<img
								v-if="form.logoDataUrl"
								:src="form.logoDataUrl"
								alt=""
								class="size-6 object-contain"
							>

							<span v-else>{{ form.orgName.slice(0, 2).toUpperCase() }}</span>
						</div>

						<div class="min-w-0 flex-1">
							<p
								class="truncate text-[0.72rem] font-extrabold tracking-widest uppercase"
								style="font-family: var(--font-display);"
							>
								{{ form.orgName }}
							</p>

							<p class="truncate text-[0.58rem] font-semibold tracking-[0.16em] uppercase opacity-70">
								{{ form.tagline }}
							</p>
						</div>

						<span class="bg-sidebar-accent text-sidebar-accent-foreground rounded-sm px-2 py-0.5 text-[0.54rem] font-bold tracking-[0.14em] uppercase">
							{{ preview.label }}
						</span>
					</div>

					<div class="space-y-3 p-5">
						<div class="border-border bg-card rounded-md border p-4">
							<p class="text-muted-foreground text-[0.58rem] font-bold tracking-[0.16em] uppercase">
								Active Orders
							</p>

							<p
								class="metric-value text-card-foreground mt-1 text-3xl font-extrabold"
								style="font-family: var(--font-display);"
							>
								24
							</p>
						</div>

						<Button
							type="button"
							class="bg-primary text-primary-foreground w-full rounded-md px-4 py-2.5 text-[0.62rem] font-bold tracking-[0.14em] uppercase"
						>
							Primary CTA
						</Button>

						<div class="border-input bg-muted text-muted-foreground rounded-md border px-3 py-2 text-[0.66rem]">
							Search orders…
						</div>

						<div class="flex gap-2">
							<span class="bg-accent text-accent-foreground rounded-sm px-2 py-0.5 text-[0.58rem] font-bold tracking-[0.14em] uppercase">
								Accent
							</span>

							<span class="bg-secondary text-secondary-foreground rounded-sm px-2 py-0.5 text-[0.58rem] font-bold tracking-[0.14em] uppercase">
								Secondary
							</span>
						</div>
					</div>
				</div>
			</aside>
		</section>
	</div>
</template>
