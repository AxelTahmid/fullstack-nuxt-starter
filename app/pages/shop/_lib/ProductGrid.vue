<script setup lang="ts">
import { PackageSearch } from "@lucide/vue"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { ProductListItem } from "#shared/types/product"
import ProductCard from "./ProductCard.vue"

defineProps<{
	products: ProductListItem[]
	pending: boolean
	hasFilters: boolean
	addingKey: string | null
	cartProductKeys: Set<string>
}>()

const emit = defineEmits<{
	add: [product: ProductListItem]
	clearFilters: []
}>()
</script>

<template>
	<div
		v-if="pending"
		class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3"
	>
		<Card
			v-for="index in 6"
			:key="index"
			class="overflow-hidden"
		>
			<CardContent class="flex min-h-32 items-center gap-3 p-0">
				<Skeleton class="h-32 w-28 shrink-0 rounded-none" />

				<div class="flex min-w-0 flex-1 flex-col justify-center gap-3 p-3">
					<div class="flex items-center justify-between gap-2">
						<Skeleton class="h-3 w-20" />

						<Skeleton class="h-5 w-16 rounded-full" />
					</div>

					<Skeleton class="h-4 w-full" />

					<Skeleton class="h-4 w-3/4" />

					<Skeleton class="h-8 w-16 self-end" />
				</div>
			</CardContent>
		</Card>
	</div>

	<Card
		v-else-if="products.length === 0"
		class="w-full min-w-0 border-dashed sm:min-w-80"
	>
		<CardContent class="flex flex-col items-center justify-center gap-3 py-12 text-center">
			<div class="flex size-10 items-center justify-center rounded-lg bg-muted">
				<PackageSearch class="size-5 text-muted-foreground" />
			</div>

			<div class="space-y-1">
				<p class="font-medium">
					No products found
				</p>

				<p class="text-sm text-muted-foreground">
					Try changing the search or clearing filters.
				</p>
			</div>

			<Button
				v-if="hasFilters"
				type="button"
				variant="outline"
				@click="emit('clearFilters')"
			>
				Clear filters
			</Button>
		</CardContent>
	</Card>

	<div
		v-else
		class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3"
	>
		<ProductCard
			v-for="product in products"
			:key="product.sourceKey"
			:product="product"
			:adding="addingKey === product.sourceKey"
			:in-cart="cartProductKeys.has(product.sourceKey)"
			@add="emit('add', $event)"
		/>
	</div>
</template>
