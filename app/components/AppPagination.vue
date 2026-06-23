<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "@lucide/vue"
import { Button } from "@/components/ui/button"

const props = defineProps<{
	totalPages: number
	totalItems?: number
	pageSize?: number
}>()

const page = defineModel<number>("page", { required: true })

const rangeLabel = computed(() => {
	if (props.totalItems === undefined || props.pageSize === undefined) {
		return ""
	}
	if (props.totalItems === 0) {
		return "No results"
	}
	const start = (page.value - 1) * props.pageSize + 1
	const end = Math.min(page.value * props.pageSize, props.totalItems)
	return `${start}–${end} of ${props.totalItems}`
})

function prev() {
	if (page.value > 1) {
		page.value -= 1
	}
}

function next() {
	if (page.value < props.totalPages) {
		page.value += 1
	}
}
</script>

<template>
	<div
		v-if="totalPages > 1 || rangeLabel"
		class="flex flex-col items-center justify-between gap-3 sm:flex-row"
	>
		<p class="text-muted-foreground text-sm">
			{{ rangeLabel }}
		</p>

		<div
			v-if="totalPages > 1"
			class="flex items-center gap-2"
		>
			<Button
				type="button"
				variant="outline"
				size="sm"
				:disabled="page <= 1"
				@click="prev"
			>
				<ChevronLeft class="size-4" />
				Previous
			</Button>

			<span class="text-muted-foreground px-1 text-sm tabular-nums">
				Page {{ page }} of {{ totalPages }}
			</span>

			<Button
				type="button"
				variant="outline"
				size="sm"
				:disabled="page >= totalPages"
				@click="next"
			>
				Next
				<ChevronRight class="size-4" />
			</Button>
		</div>
	</div>
</template>
