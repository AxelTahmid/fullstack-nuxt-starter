<script setup lang="ts">
import { formatPrice } from "./format"

defineProps<{
	name: string
	sku: string
	quantity: number
	meta?: string
	unitPriceCents?: number
	lineTotalCents?: number
}>()
</script>

<template>
	<div class="bg-muted flex items-center gap-4 rounded-md p-4">
		<div class="min-w-0 flex-1">
			<p class="text-muted-foreground truncate text-xs font-medium">
				<template v-if="meta">
					{{ meta }} ·
				</template>{{ sku }}
			</p>

			<p class="mt-1 truncate text-sm font-semibold">
				{{ name }}
			</p>

			<p
				v-if="unitPriceCents !== undefined"
				class="text-muted-foreground mt-1 text-xs"
			>
				{{ quantity }} × {{ formatPrice(unitPriceCents) }}
			</p>
		</div>

		<span
			v-if="unitPriceCents === undefined"
			class="text-sm font-semibold tabular-nums"
		>
			× {{ quantity }}
		</span>

		<p
			v-else
			class="w-28 text-right text-sm font-semibold tabular-nums"
		>
			{{ formatPrice(lineTotalCents ?? 0) }}
		</p>
	</div>
</template>
