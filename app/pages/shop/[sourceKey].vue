<script setup lang="ts">
import { AlertCircle, ArrowLeft, Check, ImageIcon, LoaderCircle, Plus } from "@lucide/vue"
import type { FetchError } from "ofetch"
import type { ProductDetailResponse } from "#shared/types/product"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "~/components/toast"
import { useCart } from "~/composables/useCart"
import { formatPrice, stockLabel } from "./_lib/format"

definePageMeta({
	layout: "dashboard",
	middleware: ["authenticated"],
})

const route = useRoute()
const cart = useCart()
await cart.refresh()

const sourceKey = computed(() => {
	const value = route.params.sourceKey
	return Array.isArray(value) ? value[0] ?? "" : String(value ?? "")
})

const { data, error } = await useFetch<ProductDetailResponse>(
	() => `/api/products/${encodeURIComponent(sourceKey.value)}`,
)

const product = computed(() => data.value?.product)
const pricing = computed(() => data.value?.pricing)
const inventory = computed(() => data.value?.inventory)
const sage = computed(() => data.value?.sage)
const isInCart = computed(() => {
	const key = product.value?.sourceKey
	return key ? cart.summary.value.lines.some(line => line.sku === key) : false
})

useHead({
	title: computed(() => product.value?.name ? `${product.value.name} · Product` : "Product detail"),
})

const adding = ref(false)

function valueOrDash(value: string | number | boolean | null | undefined) {
	if (value === null || value === undefined || value === "") {
		return "-"
	}

	if (typeof value === "boolean") {
		return value ? "Yes" : "No"
	}

	return String(value)
}

function formatDate(value: string | null | undefined) {
	if (!value) {
		return "-"
	}

	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(value))
}

function formatOptionalPrice(cents: number | null | undefined, currencyCode: string | null | undefined) {
	if (cents === null || cents === undefined || !currencyCode) {
		return "-"
	}

	return formatPrice(cents, currencyCode)
}

const inventoryRows = computed(() => [
	{ label: "Available", value: valueOrDash(inventory.value?.quantityAvailable) },
	{ label: "On hand", value: valueOrDash(inventory.value?.quantityOnHand) },
	{ label: "Committed", value: valueOrDash(inventory.value?.quantityCommitted) },
	{ label: "On purchase order", value: valueOrDash(inventory.value?.quantityOnPurchaseOrder) },
	{ label: "On sales order", value: valueOrDash(inventory.value?.quantityOnSalesOrder) },
	{ label: "Stocking UOM", value: valueOrDash(inventory.value?.stockingUnitOfMeasure) },
	{ label: "Unit weight", value: valueOrDash(inventory.value?.unitWeight) },
	{ label: "Weight UOM", value: valueOrDash(inventory.value?.weightUnitOfMeasure) },
])

const sageRows = computed(() => [
	{ label: "Item number", value: valueOrDash(sage.value?.itemNumber) },
	{ label: "Sage key", value: valueOrDash(sage.value?.unformattedItemNumber) },
	{ label: "Account set", value: valueOrDash(sage.value?.accountSetCode) },
	{ label: "Default price list", value: valueOrDash(sage.value?.defaultPriceListCode) },
	{ label: "Vendor item", value: valueOrDash(sage.value?.preferredVendorItem) },
	{ label: "Tariff code", value: valueOrDash(sage.value?.tariffCode) },
	{ label: "Stock item", value: valueOrDash(sage.value?.stockItem) },
	{ label: "Sellable", value: valueOrDash(sage.value?.sellable) },
	{ label: "Active", value: valueOrDash(sage.value?.active) },
	{ label: "Last maintained", value: formatDate(sage.value?.dateLastMaintained) },
	{ label: "Inactive date", value: formatDate(sage.value?.dateInactive) },
])

async function addToCart() {
	if (!product.value) {
		return
	}

	adding.value = true
	try {
		await cart.addItem(product.value.sourceKey, 1)
		toast.success("Added to cart.")
	}
	catch (error) {
		const fetchError = error as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to add to cart.")
	}
	finally {
		adding.value = false
	}
}
</script>

<template>
	<div class="space-y-6">
		<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
			<div class="space-y-3">
				<Button
					as-child
					variant="ghost"
					size="sm"
					class="w-fit px-2"
				>
					<NuxtLink to="/shop">
						<ArrowLeft class="size-4" />
						Back to shop
					</NuxtLink>
				</Button>

				<div
					v-if="product"
					class="space-y-2"
				>
					<div class="flex flex-wrap items-center gap-2">
						<p class="text-sm font-medium text-muted-foreground">
							{{ product.sku }}
						</p>

						<Badge variant="secondary">
							{{ stockLabel(product.stockStatus) }}
						</Badge>
					</div>

					<h1 class="max-w-4xl text-3xl font-semibold tracking-tight">
						{{ product.name }}
					</h1>

					<p class="text-sm text-muted-foreground">
						{{ product.category }} / {{ product.manufacturer }}
					</p>
				</div>

				<div
					v-else
					class="space-y-3"
				>
					<Skeleton class="h-4 w-28" />

					<Skeleton class="h-9 w-80 max-w-full" />

					<Skeleton class="h-4 w-52" />
				</div>
			</div>

			<Button
				v-if="product"
				type="button"
				:disabled="adding"
				@click="addToCart"
			>
				<LoaderCircle
					v-if="adding"
					class="size-4 animate-spin"
				/>

				<Check
					v-else-if="isInCart"
					class="size-4"
				/>

				<Plus
					v-else
					class="size-4"
				/>
				Add to cart
			</Button>
		</div>

		<Alert
			v-if="error"
			variant="destructive"
		>
			<AlertCircle class="size-4" />

			<AlertTitle>Unable to load product</AlertTitle>

			<AlertDescription>
				Sage did not return the requested product detail.
			</AlertDescription>
		</Alert>

		<div
			v-else
			class="grid gap-6 xl:grid-cols-[minmax(18rem,24rem)_1fr]"
		>
			<Card class="overflow-hidden py-0">
				<div class="aspect-square bg-muted">
					<img
						v-if="product?.imageUrl"
						:src="product.imageUrl"
						:alt="product.name"
						class="size-full object-cover"
					>

					<div
						v-else
						class="flex size-full items-center justify-center text-muted-foreground"
					>
						<ImageIcon class="size-12" />
					</div>
				</div>
			</Card>

			<div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
				<div class="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Description</CardTitle>
						</CardHeader>

						<CardContent class="space-y-4">
							<p class="text-sm leading-6 text-muted-foreground">
								{{ product?.description || "No product description was returned by Sage." }}
							</p>

							<div
								v-if="data?.comments.length"
								class="space-y-2"
							>
								<p class="text-sm font-medium">
									Sage comments
								</p>

								<ul class="space-y-1 text-sm text-muted-foreground">
									<li
										v-for="comment in data.comments"
										:key="comment"
									>
										{{ comment }}
									</li>
								</ul>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Inventory</CardTitle>
						</CardHeader>

						<CardContent>
							<dl class="grid gap-3 sm:grid-cols-2">
								<div
									v-for="row in inventoryRows"
									:key="row.label"
									class="rounded-md border p-3"
								>
									<dt class="text-xs font-medium text-muted-foreground">
										{{ row.label }}
									</dt>

									<dd class="mt-1 text-sm font-semibold">
										{{ row.value }}
									</dd>
								</div>
							</dl>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Sage details</CardTitle>
						</CardHeader>

						<CardContent>
							<dl class="grid gap-3 sm:grid-cols-2">
								<div
									v-for="row in sageRows"
									:key="row.label"
									class="rounded-md border p-3"
								>
									<dt class="text-xs font-medium text-muted-foreground">
										{{ row.label }}
									</dt>

									<dd class="mt-1 break-words text-sm font-semibold">
										{{ row.value }}
									</dd>
								</div>
							</dl>
						</CardContent>
					</Card>
				</div>

				<Card class="h-fit">
					<CardHeader>
						<CardTitle>Pricing</CardTitle>
					</CardHeader>

					<CardContent class="space-y-5">
						<div>
							<p class="text-sm text-muted-foreground">
								Current Sage price
							</p>

							<p
								v-if="formatOptionalPrice(pricing?.unitPriceCents, pricing?.currencyCode) !== '-'"
								class="mt-1 text-3xl font-semibold tracking-tight"
							>
								{{ formatOptionalPrice(pricing?.unitPriceCents, pricing?.currencyCode) }}
							</p>

							<p
								v-else
								class="mt-1 text-lg font-semibold"
							>
								Price unavailable
							</p>

							<p class="mt-1 text-sm text-muted-foreground">
								Per {{ pricing?.unitOfMeasure || inventory?.stockingUnitOfMeasure || "unit" }}
							</p>
						</div>

						<Alert v-if="pricing?.unavailableReason">
							<AlertCircle class="size-4" />

							<AlertTitle>Pricing not returned</AlertTitle>

							<AlertDescription>
								{{ pricing.unavailableReason }}
							</AlertDescription>
						</Alert>

						<dl class="space-y-3 text-sm">
							<div class="flex items-center justify-between gap-3">
								<dt class="text-muted-foreground">
									Currency
								</dt>

								<dd class="font-medium">
									{{ pricing?.currencyCode || "-" }}
								</dd>
							</div>

							<div class="flex items-center justify-between gap-3">
								<dt class="text-muted-foreground">
									Price list
								</dt>

								<dd class="font-medium">
									{{ pricing?.priceListCode || "-" }}
								</dd>
							</div>

							<div class="flex items-center justify-between gap-3">
								<dt class="text-muted-foreground">
									Base price
								</dt>

								<dd class="font-medium">
									{{ formatOptionalPrice(pricing?.basePriceCents, pricing?.currencyCode) }}
								</dd>
							</div>

							<div class="flex items-center justify-between gap-3">
								<dt class="text-muted-foreground">
									Sale price
								</dt>

								<dd class="font-medium">
									{{ formatOptionalPrice(pricing?.salePriceCents, pricing?.currencyCode) }}
								</dd>
							</div>

							<div class="flex items-center justify-between gap-3">
								<dt class="text-muted-foreground">
									Sale starts
								</dt>

								<dd class="font-medium">
									{{ formatDate(pricing?.saleStartsOn) }}
								</dd>
							</div>

							<div class="flex items-center justify-between gap-3">
								<dt class="text-muted-foreground">
									Sale ends
								</dt>

								<dd class="font-medium">
									{{ formatDate(pricing?.saleEndsOn) }}
								</dd>
							</div>
						</dl>
					</CardContent>
				</Card>
			</div>
		</div>
	</div>
</template>
