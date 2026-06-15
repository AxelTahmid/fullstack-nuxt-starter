<script setup lang="ts">
import { Check, ChevronLeft, ChevronRight, LoaderCircle, Plus, Search } from "@lucide/vue"
import type { FetchError } from "ofetch"
import type { ProductListItem, ProductListResponse } from "#shared/types/product"
import { toast } from "~/components/toast"
import { useCart } from "~/composables/useCart"

definePageMeta({
	layout: "dashboard",
	middleware: ["authenticated"],
})

useHead({
	title: "Shop Products",
})

const route = useRoute()
const cart = useCart()
await cart.refresh()

const category = computed(() => typeof route.query.category === "string" ? route.query.category : "")
const manufacturer = computed(() => typeof route.query.manufacturer === "string" ? route.query.manufacturer : "")
const q = ref(typeof route.query.q === "string" ? route.query.q : "")
const page = computed(() => {
	const raw = typeof route.query.page === "string" ? Number.parseInt(route.query.page, 10) : 1
	return Number.isFinite(raw) && raw > 0 ? raw : 1
})

const apiQuery = computed(() => ({
	category: category.value || undefined,
	manufacturer: manufacturer.value || undefined,
	q: typeof route.query.q === "string" && route.query.q.length > 0 ? route.query.q : undefined,
	page: page.value > 1 ? page.value : undefined,
}))

const { data, pending, refresh } = await useFetch<ProductListResponse>("/api/products", {
	query: apiQuery,
})

async function updateQuery(next: Record<string, string | undefined>) {
	const merged = { ...route.query, ...next }
	Object.keys(merged).forEach((key) => {
		if (merged[key] === undefined || merged[key] === "") {
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			delete merged[key]
		}
	})
	await navigateTo({ path: route.path, query: merged })
}

function setCategory(value: string) {
	updateQuery({ category: value === category.value ? undefined : value, page: undefined })
}

function setManufacturer(value: string) {
	updateQuery({ manufacturer: value === manufacturer.value ? undefined : value, page: undefined })
}

function submitSearch() {
	updateQuery({ q: q.value || undefined, page: undefined })
}

function goToPage(nextPage: number) {
	const totalPages = data.value?.totalPages ?? 1
	const bounded = Math.min(Math.max(nextPage, 1), totalPages)
	updateQuery({ page: bounded > 1 ? String(bounded) : undefined })
}

async function clearFilters() {
	q.value = ""
	await navigateTo({ path: route.path, query: {} })
}

const addingKey = ref<string | null>(null)
async function handleAdd(product: ProductListItem) {
	addingKey.value = product.sourceKey
	try {
		await cart.addItem(product.sourceKey, 1)
		toast.success("Added to cart.")
	}
	catch (error) {
		const fetchError = error as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to add to cart.")
	}
	finally {
		addingKey.value = null
	}
}

function formatPrice(cents: number) {
	return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const hasFilters = computed(() => category.value || manufacturer.value || q.value)
const pageNumbers = computed(() => {
	const current = data.value?.page ?? page.value
	const totalPages = data.value?.totalPages ?? 1
	const start = Math.max(1, Math.min(current - 2, totalPages - 4))
	const end = Math.min(totalPages, start + 4)

	return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})
const rangeStart = computed(() => {
	const response = data.value
	if (!response || response.total === 0) return 0
	return (response.page - 1) * response.pageSize + 1
})
const rangeEnd = computed(() => {
	const response = data.value
	if (!response) return 0
	return Math.min(response.total, response.page * response.pageSize)
})
</script>

<template>
	<div class="space-y-8">
		<section class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
			<div class="space-y-2">
				<p class="text-muted-foreground text-[0.68rem] font-bold tracking-[0.24em] uppercase">
					Catalog
				</p>

				<h1
					class="text-foreground text-5xl font-extrabold tracking-[-0.045em]"
					style="font-family: var(--font-display);"
				>
					Shop Products
				</h1>

				<p class="text-muted-foreground max-w-2xl text-sm leading-7">
					Industrial equipment, safety gear, precision tools, and consumables. Add items to your cart to build an order.
				</p>
			</div>

			<div class="flex items-center gap-3">
				<NuxtLink
					to="/cart"
					class="border-border/70 bg-card text-foreground hover:border-primary hover:text-primary inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-[0.72rem] font-bold tracking-[0.15em] uppercase transition-all"
				>
					Cart ({{ cart.summary.value.itemCount }})
				</NuxtLink>
			</div>
		</section>

		<section class="grid gap-6 lg:grid-cols-[18rem_1fr]">
			<aside class="space-y-6">
				<div class="border-border/60 bg-card rounded-md border p-5">
					<Label class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
						Search
					</Label>

					<div class="mt-3 flex gap-2">
						<div class="relative flex-1">
							<Search class="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />

							<Input
								v-model="q"
								type="text"
								placeholder="SKU, name, description"
								class="bg-muted text-foreground placeholder:text-muted-foreground/60 focus:ring-primary/50 w-full rounded-md px-3 py-2 pl-8 text-sm focus:ring-2 focus:outline-none"
								@keyup.enter="submitSearch"
							/>
						</div>

						<Button
							type="button"
							class="bg-primary text-primary-foreground rounded-md px-3 text-[0.68rem] font-bold tracking-[0.14em] uppercase transition-all hover:brightness-110"
							@click="submitSearch"
						>
							Go
						</Button>
					</div>
				</div>

				<div class="border-border/60 bg-card rounded-md border p-5">
					<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
						Categories
					</p>

					<ul class="mt-3 space-y-1">
						<li
							v-for="facet in data?.facets.categories ?? []"
							:key="facet.value"
						>
							<Button
								type="button"
								class="group flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-all"
								:class="category === facet.value ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted text-foreground'"
								@click="setCategory(facet.value)"
							>
								<span>{{ facet.value }}</span>

								<span
									class="text-[0.62rem] font-bold tracking-wide"
									:class="category === facet.value ? 'text-primary-foreground/70' : 'text-muted-foreground'"
								>
									{{ facet.count }}
								</span>
							</Button>
						</li>
					</ul>
				</div>

				<div class="border-border/60 bg-card rounded-md border p-5">
					<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
						Manufacturers
					</p>

					<ul class="mt-3 space-y-1">
						<li
							v-for="facet in data?.facets.manufacturers ?? []"
							:key="facet.value"
						>
							<Button
								type="button"
								class="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-all"
								:class="manufacturer === facet.value ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted text-foreground'"
								@click="setManufacturer(facet.value)"
							>
								<span>{{ facet.value }}</span>

								<span
									class="text-[0.62rem] font-bold tracking-wide"
									:class="manufacturer === facet.value ? 'text-primary-foreground/70' : 'text-muted-foreground'"
								>
									{{ facet.count }}
								</span>
							</Button>
						</li>
					</ul>
				</div>

				<Button
					v-if="hasFilters"
					type="button"
					class="border-border/70 bg-card text-muted-foreground hover:border-primary hover:text-primary w-full rounded-md border px-4 py-2 text-[0.68rem] font-bold tracking-[0.15em] uppercase transition-all"
					@click="clearFilters"
				>
					Clear Filters
				</Button>
			</aside>

			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<p class="text-muted-foreground text-[0.68rem] font-bold tracking-[0.16em] uppercase">
						{{ pending ? "Loading…" : `${data?.total ?? 0} products` }}
					</p>

					<Button
						type="button"
						class="text-muted-foreground hover:text-primary text-[0.68rem] font-bold tracking-[0.15em] uppercase transition-colors"
						@click="refresh()"
					>
						Refresh
					</Button>
				</div>

				<div
					v-if="pending"
					class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
				>
					<div
						v-for="i in 6"
						:key="i"
						class="bg-muted h-80 animate-pulse rounded-md"
					/>
				</div>

				<div
					v-else-if="!data?.items.length"
					class="border-border/60 bg-card rounded-md border p-12 text-center"
				>
					<p class="text-muted-foreground text-sm">
						No products match these filters.
					</p>

					<Button
						type="button"
						class="bg-primary text-primary-foreground mt-4 rounded-md px-4 py-2 text-[0.68rem] font-bold tracking-[0.15em] uppercase transition-all hover:brightness-110"
						@click="clearFilters"
					>
						Clear filters
					</Button>
				</div>

				<div
					v-else
					class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
				>
					<article
						v-for="product in data.items"
						:key="product.sourceKey"
						class="group border-border/60 bg-card hover:border-primary/40 flex flex-col overflow-hidden rounded-md border transition-all"
					>
						<div class="bg-muted aspect-4/3 overflow-hidden">
							<img
								v-if="product.imageUrl"
								:src="product.imageUrl"
								:alt="product.name"
								class="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
							>

							<div
								v-else
								class="text-muted-foreground flex size-full items-center justify-center"
							>
								No image
							</div>
						</div>

						<div class="flex flex-1 flex-col gap-3 p-5">
							<div class="text-muted-foreground flex items-center justify-between text-[0.62rem] font-bold tracking-[0.14em] uppercase">
								<span>{{ product.manufacturer }}</span>

								<span>{{ product.sku }}</span>
							</div>

							<h3
								class="text-foreground text-lg font-bold tracking-[-0.015em]"
								style="font-family: var(--font-display);"
							>
								{{ product.name }}
							</h3>

							<p class="text-muted-foreground line-clamp-2 text-xs">
								{{ product.description }}
							</p>

							<div class="mt-auto flex items-end justify-between pt-3">
								<div>
									<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.14em] uppercase">
										Current Price
									</p>

									<p
										class="metric-value text-foreground text-2xl font-extrabold"
										style="font-family: var(--font-display);"
									>
										{{ product.priceCents === null ? "In cart" : formatPrice(product.priceCents) }}
									</p>
								</div>

								<Button
									type="button"
									class="bg-primary text-primary-foreground flex items-center gap-1.5 rounded-md px-3 py-2 text-[0.68rem] font-bold tracking-[0.14em] uppercase transition-all hover:brightness-110 disabled:opacity-60"
									:disabled="addingKey === product.sourceKey"
									@click="handleAdd(product)"
								>
									<LoaderCircle
										v-if="addingKey === product.sourceKey"
										class="size-4 animate-spin"
									/>

									<Check
										v-else-if="cart.summary.value.lines.some(l => l.sku === product.sourceKey)"
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
					</article>
				</div>

				<div
					v-if="data && data.totalPages > 1"
					class="border-border/60 bg-card flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
				>
					<p class="text-muted-foreground text-sm">
						Showing {{ rangeStart }}-{{ rangeEnd }} of {{ data.total }} products
					</p>

					<div class="flex items-center gap-1">
						<Button
							type="button"
							variant="outline"
							size="sm"
							class="size-8 rounded-md p-0"
							:disabled="!data.hasPreviousPage || pending"
							@click="goToPage(data.page - 1)"
						>
							<ChevronLeft class="size-4" />
						</Button>

						<Button
							v-for="pageNumber in pageNumbers"
							:key="pageNumber"
							type="button"
							size="sm"
							class="size-8 rounded-md p-0 text-xs font-semibold"
							:variant="pageNumber === data.page ? 'default' : 'outline'"
							:disabled="pending"
							@click="goToPage(pageNumber)"
						>
							{{ pageNumber }}
						</Button>

						<Button
							type="button"
							variant="outline"
							size="sm"
							class="size-8 rounded-md p-0"
							:disabled="!data.hasNextPage || pending"
							@click="goToPage(data.page + 1)"
						>
							<ChevronRight class="size-4" />
						</Button>
					</div>
				</div>
			</div>
		</section>
	</div>
</template>
