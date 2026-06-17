import { useBrand } from "~/composables/useBrand"

export default defineNuxtPlugin(async () => {
	const { brand, refresh } = useBrand()

	if (!brand.value) {
		await refresh()
	}

	useHead({
		style: [
			{
				tagPosition: "bodyClose",
				innerHTML: () => {
					const b = brand.value
					if (!b?.theme)
						return ""

					const block = (selector: string, tokens: Record<string, string>, extra: string) =>
						`${selector}{${Object.entries(tokens)
							.map(([token, value]) => `${token}:${value} !important;`)
							.join("")}${extra}}`

					// `--sidebar-background` mirrors `--sidebar`; `--radius` is theme-wide.
					const light = block(
						":root",
						b.theme.light,
						`--sidebar-background:${b.theme.light["--sidebar"]} !important;${b.radius ? `--radius:${b.radius} !important;` : ""}`,
					)
					const dark = block(
						".dark",
						b.theme.dark,
						`--sidebar-background:${b.theme.dark["--sidebar"]} !important;`,
					)

					return `${light}${dark}`
				},
			},
		],
	})
})
