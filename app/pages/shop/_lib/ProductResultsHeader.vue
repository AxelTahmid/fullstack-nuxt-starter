<script setup lang="ts">
import { Badge } from "@/components/ui/badge"
import { formatCount } from "./format"

defineProps<{
	pending: boolean
	visibleCount: number
	total: number
	rangeStart: number
	rangeEnd: number
	hasFilters: boolean
	category: string
	manufacturer: string
	search: string
}>()
</script>

<template>
	<div class="flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
		<div class="space-y-1">
			<p class="text-sm font-medium">
				{{ pending ? "Refreshing catalog" : `${formatCount(visibleCount)} visible products` }}
			</p>

			<p class="text-sm text-muted-foreground">
				Showing {{ rangeStart }}-{{ rangeEnd }} of {{ formatCount(total) }}
			</p>
		</div>

		<div
			v-if="hasFilters"
			class="flex flex-wrap gap-2"
		>
			<Badge
				v-if="category"
				variant="outline"
			>
				Category: {{ category }}
			</Badge>

			<Badge
				v-if="manufacturer"
				variant="outline"
			>
				Manufacturer: {{ manufacturer }}
			</Badge>

			<Badge
				v-if="search"
				variant="outline"
			>
				Search: {{ search }}
			</Badge>
		</div>
	</div>
</template>
