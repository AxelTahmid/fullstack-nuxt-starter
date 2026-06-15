<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "@lucide/vue"
import { Button } from "@/components/ui/button"
import type { ProductListResponse } from "#shared/types/product"

defineProps<{
	response: ProductListResponse | null | undefined
	pageNumbers: number[]
	pending: boolean
}>()

const emit = defineEmits<{
	goToPage: [page: number]
}>()
</script>

<template>
	<div
		v-if="response && response.totalPages > 1"
		class="flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
	>
		<p class="text-sm text-muted-foreground">
			Page {{ response.page }} of {{ response.totalPages }}
		</p>

		<div class="flex items-center gap-1">
			<Button
				type="button"
				variant="outline"
				size="icon"
				:disabled="!response.hasPreviousPage || pending"
				aria-label="Previous page"
				@click="emit('goToPage', response.page - 1)"
			>
				<ChevronLeft class="size-4" />
			</Button>

			<Button
				v-for="pageNumber in pageNumbers"
				:key="pageNumber"
				type="button"
				size="sm"
				class="min-w-9"
				:variant="pageNumber === response.page ? 'default' : 'outline'"
				:disabled="pending"
				@click="emit('goToPage', pageNumber)"
			>
				{{ pageNumber }}
			</Button>

			<Button
				type="button"
				variant="outline"
				size="icon"
				:disabled="!response.hasNextPage || pending"
				aria-label="Next page"
				@click="emit('goToPage', response.page + 1)"
			>
				<ChevronRight class="size-4" />
			</Button>
		</div>
	</div>
</template>
