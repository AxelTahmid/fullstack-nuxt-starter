<script setup lang="ts">
import type { FetchError } from "ofetch"
import type { ProductListItem, ProductListResponse } from "#shared/types/product"
import { toast } from "~/components/toast"
import { useCart } from "~/composables/useCart"
import ProductGrid from "./_lib/ProductGrid.vue"
import ProductResultsHeader from "./_lib/ProductResultsHeader.vue"
import ShopErrorAlert from "./_lib/ShopErrorAlert.vue"
import ShopFilters from "./_lib/ShopFilters.vue"
import ShopHeader from "./_lib/ShopHeader.vue"
import ShopPagination from "./_lib/ShopPagination.vue"

definePageMeta({
	layout: "dashboard",
	middleware: ["authenticated"],
})

useHead({
	title: "Shop products",
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

watch(
	() => route.query.q,
	(value) => {
		q.value = typeof value === "string" ? value : ""
	},
)

const apiQuery = computed(() => ({
	category: category.value || undefined,
	manufacturer: manufacturer.value || undefined,
	q: typeof route.query.q === "string" && route.query.q.length > 0 ? route.query.q : undefined,
	page: page.value > 1 ? page.value : undefined,
}))

const { data, pending, error, refresh } = await useFetch<ProductListResponse>("/api/products", {
	query: apiQuery,
})

async function updateQuery(next: Record<string, string | undefined>) {
	const merged: Record<string, string> = {}
	const clearedKeys = new Set(
		Object.entries(next)
			.filter(([, value]) => !value || value.length === 0)
			.map(([key]) => key),
	)

	Object.entries(route.query).forEach(([key, value]) => {
		if (!clearedKeys.has(key) && typeof value === "string" && value.length > 0) {
			merged[key] = value
		}
	})

	Object.entries(next).forEach(([key, value]) => {
		if (value && value.length > 0) {
			merged[key] = value
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
	updateQuery({ q: q.value.trim() || undefined, page: undefined })
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

const products = computed(() => data.value?.items ?? [])
const categoryFacets = computed(() => data.value?.facets.categories ?? [])
const manufacturerFacets = computed(() => data.value?.facets.manufacturers ?? [])
const hasFilters = computed(() => Boolean(category.value || manufacturer.value || q.value))
const cartProductKeys = computed(() => new Set(cart.summary.value.lines.map(line => line.sku)))
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
	<div class="space-y-6">
		<ShopHeader
			:pending="pending"
			:cart-item-count="cart.summary.value.itemCount"
			@refresh="refresh()"
		/>

		<ShopErrorAlert v-if="error" />

		<section class="grid gap-6 xl:grid-cols-[19rem_1fr]">
			<ShopFilters
				v-model:search="q"
				:pending="pending"
				:has-filters="hasFilters"
				:category="category"
				:manufacturer="manufacturer"
				:category-facets="categoryFacets"
				:manufacturer-facets="manufacturerFacets"
				@search="submitSearch"
				@clear="clearFilters"
				@select-category="setCategory"
				@select-manufacturer="setManufacturer"
			/>

			<div class="space-y-4">
				<ProductResultsHeader
					:pending="pending"
					:visible-count="products.length"
					:total="data?.total ?? 0"
					:range-start="rangeStart"
					:range-end="rangeEnd"
					:has-filters="hasFilters"
					:category="category"
					:manufacturer="manufacturer"
					:search="q"
				/>

				<ProductGrid
					:products="products"
					:pending="pending"
					:has-filters="hasFilters"
					:adding-key="addingKey"
					:cart-product-keys="cartProductKeys"
					@add="handleAdd"
					@clear-filters="clearFilters"
				/>

				<ShopPagination
					:response="data"
					:page-numbers="pageNumbers"
					:pending="pending"
					@go-to-page="goToPage"
				/>
			</div>
		</section>
	</div>
</template>
