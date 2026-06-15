<script setup lang="ts">
import type { ProductListItem } from "#shared/types/product"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Check, ImageIcon, LoaderCircle, Plus } from "@lucide/vue"
import { stockLabel } from "./format"

defineProps<{
	product: ProductListItem
	adding: boolean
	inCart: boolean
}>()

const emit = defineEmits<{
	add: [product: ProductListItem]
}>()
</script>

<template>
	<Card class="py-0 overflow-hidden transition-colors hover:border-primary/50">
		<div class="flex min-h-32 items-center">
			<div class="h-32 w-28 shrink-0 overflow-hidden bg-muted">
				<img
					v-if="product.imageUrl"
					:src="product.imageUrl"
					:alt="product.name"
					class="size-full object-cover"
				>

				<div
					v-else
					class="flex size-full items-center justify-center text-muted-foreground"
				>
					<ImageIcon class="size-6" />
				</div>
			</div>

			<div class="flex min-w-0 flex-1 flex-col justify-center gap-2 p-3">
				<div class="flex items-center justify-between gap-2">
					<p class="truncate text-xs font-medium text-muted-foreground">
						{{ product.sku }}
					</p>

					<Badge
						variant="secondary"
						class="shrink-0 text-[0.68rem]"
					>
						{{ stockLabel(product.stockStatus) }}
					</Badge>
				</div>

				<div class="min-w-0 space-y-1">
					<h2 class="line-clamp-2 text-sm font-semibold leading-5">
						{{ product.name }}
					</h2>

					<p class="truncate text-xs text-muted-foreground">
						{{ product.category }} / {{ product.manufacturer }}
					</p>
				</div>

				<div class="flex justify-end">
					<Button
						type="button"
						size="sm"
						:disabled="adding"
						@click="emit('add', product)"
					>
						<LoaderCircle
							v-if="adding"
							class="size-4 animate-spin"
						/>

						<Check
							v-else-if="inCart"
							class="size-4"
						/>

						<Plus
							v-else
							class="size-4"
						/>
						Add
					</Button>
				</div>
			</div>
		</div>
	</Card>
</template>
