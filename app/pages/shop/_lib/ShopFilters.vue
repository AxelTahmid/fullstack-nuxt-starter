<script setup lang="ts">
import { Filter, Search, X } from "@lucide/vue"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import type { ProductFacet } from "./types"

defineProps<{
	search: string
	pending: boolean
	hasFilters: boolean
	category: string
	manufacturer: string
	categoryFacets: ProductFacet[]
	manufacturerFacets: ProductFacet[]
}>()

const emit = defineEmits<{
	"update:search": [value: string]
	"search": []
	"clear": []
	"selectCategory": [value: string]
	"selectManufacturer": [value: string]
}>()
</script>

<template>
	<aside class="space-y-4">
		<Card>
			<CardHeader class="space-y-1 pb-3">
				<div class="flex items-center justify-between gap-3">
					<h2 class="flex items-center gap-2 text-base font-semibold">
						<Filter class="size-4" />
						Filters
					</h2>

					<Button
						v-if="hasFilters"
						type="button"
						variant="ghost"
						size="sm"
						class="h-8 px-2"
						@click="emit('clear')"
					>
						<X class="size-4" />
						Clear
					</Button>
				</div>
			</CardHeader>

			<CardContent class="space-y-5">
				<div class="space-y-2">
					<Label for="product-search">Search</Label>

					<div class="flex gap-2">
						<div class="relative min-w-0 flex-1">
							<Search class="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

							<Input
								id="product-search"
								:model-value="search"
								type="text"
								placeholder="SKU, name, description"
								class="pl-8"
								@update:model-value="emit('update:search', String($event))"
								@keyup.enter="emit('search')"
							/>
						</div>

						<Button
							type="button"
							:disabled="pending"
							@click="emit('search')"
						>
							Go
						</Button>
					</div>
				</div>

				<div class="space-y-2">
					<div class="text-sm">
						<p class="font-medium">
							Categories
						</p>
					</div>

					<div
						v-if="pending && categoryFacets.length === 0"
						class="space-y-2"
					>
						<Skeleton
							v-for="index in 5"
							:key="index"
							class="h-9 w-full"
						/>
					</div>

					<div
						v-else-if="categoryFacets.length === 0"
						class="rounded-md border border-dashed p-4 text-sm text-muted-foreground"
					>
						No categories found.
					</div>

					<ul
						v-else
						class="max-h-80 space-y-1 overflow-y-auto pr-1"
					>
						<li
							v-for="facet in categoryFacets"
							:key="facet.value"
						>
							<Button
								type="button"
								variant="ghost"
								class="h-auto w-full justify-start px-2 py-2 text-left"
								:class="category === facet.value ? 'bg-accent text-accent-foreground' : ''"
								@click="emit('selectCategory', facet.value)"
							>
								<span class="min-w-0 truncate">{{ facet.value }}</span>
							</Button>
						</li>
					</ul>
				</div>

				<div class="space-y-2">
					<div class="text-sm">
						<p class="font-medium">
							Manufacturers
						</p>
					</div>

					<ul
						v-if="manufacturerFacets.length > 0"
						class="max-h-64 space-y-1 overflow-y-auto pr-1"
					>
						<li
							v-for="facet in manufacturerFacets"
							:key="facet.value"
						>
							<Button
								type="button"
								variant="ghost"
								class="h-auto w-full justify-start px-2 py-2 text-left"
								:class="manufacturer === facet.value ? 'bg-accent text-accent-foreground' : ''"
								@click="emit('selectManufacturer', facet.value)"
							>
								<span class="min-w-0 truncate">{{ facet.value }}</span>
							</Button>
						</li>
					</ul>

					<div
						v-else
						class="rounded-md border border-dashed p-4 text-sm text-muted-foreground"
					>
						No manufacturers found.
					</div>
				</div>
			</CardContent>
		</Card>
	</aside>
</template>
