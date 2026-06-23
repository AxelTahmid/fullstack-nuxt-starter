<script setup lang="ts">
import { AlertCircle, ArrowLeft, Check, ImageIcon, LoaderCircle, MessageSquarePlus, Plus } from "@lucide/vue"
import type { FetchError } from "ofetch"
import type { ICItemPricingDetailT, ICItemPricingT, ICItemT } from "#shared/sage300"
import type { StockStatus } from "#shared/types/product"
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

const { data, error } = await useFetch<{
	item: ICItemT
	pricing: ICItemPricingT | null
	pricingUnavailableReason: string | null
}>(() => `/api/products/${encodeURIComponent(sourceKey.value)}`)

const item = computed(() => data.value?.item)
const pricing = computed(() => data.value?.pricing)
const itemSourceKey = computed(() => item.value?.UnformattedItemNumber || item.value?.ItemNumber || sourceKey.value)
const comments = computed(() => [item.value?.Comment1, item.value?.Comment2, item.value?.Comment3, item.value?.Comment4]
	.map(comment => comment?.trim())
	.filter((comment): comment is string => Boolean(comment)))
const itemName = computed(() => item.value?.Description?.trim() || item.value?.ItemNumber?.trim() || itemSourceKey.value || "Unnamed item")
const itemDescription = computed(() => comments.value.join(" ") || item.value?.Description?.trim() || "No product description is available.")
const itemCategory = computed(() => item.value?.Category?.trim() || "Uncategorized")
const itemManufacturer = computed(() => item.value?.PreferredVendor?.trim() || "Manufacturer unavailable")
const itemStockStatus = computed<StockStatus>(() => {
	const sageItem = item.value
	if (!sageItem || sageItem.Sellable === false || sageItem.Status === false) {
		return "out_of_stock"
	}

	const available = sageItem.QuantityAvailable ?? sageItem.QuantityOnHand
	if (typeof available !== "number") {
		return "in_stock"
	}

	if (available <= 0) {
		return "out_of_stock"
	}

	return available <= 5 ? "low_stock" : "in_stock"
})
const defaultPricingDetail = computed<ICItemPricingDetailT | undefined>(() => pricing.value?.ItemPricingDetails?.find(detail => detail.DefaultUnit && typeof detail.UnitPrice === "number" && detail.UnitPrice > 0)
	?? pricing.value?.ItemPricingDetails?.find(detail => typeof detail.UnitPrice === "number" && detail.UnitPrice > 0))
// A 0 SalePrice / BasePrice means "not set", so only use positive values —
// otherwise the current price reads $0.00 when an item simply isn't on sale.
const unitPrice = computed(() => {
	const sale = typeof pricing.value?.SalePrice === "number" && pricing.value.SalePrice > 0 ? pricing.value.SalePrice : null
	const base = typeof pricing.value?.BasePrice === "number" && pricing.value.BasePrice > 0 ? pricing.value.BasePrice : null
	return sale ?? defaultPricingDetail.value?.UnitPrice ?? base ?? null
})
const currencyCode = computed(() => pricing.value?.CurrencyCode || "CAD")
const unitOfMeasure = computed(() => pricing.value?.SaleUnitOfMeasure
	|| pricing.value?.PricingUnitOfMeasure
	|| defaultPricingDetail.value?.QuantityUnit
	|| item.value?.StockingUnitOfMeasure
	|| "unit")
const pricingUnavailableReason = computed(() => data.value?.pricingUnavailableReason
	|| (pricing.value && unitPrice.value === null ? "Pricing exists, but no unit price was returned." : null))
const isInCart = computed(() => cart.summary.value.lines.some(line => line.sku === itemSourceKey.value))

useHead({
	title: computed(() => itemName.value ? `${itemName.value} · Product` : "Product detail"),
})

const adding = ref(false)

const { user } = useUserSession()
const isAdmin = computed(() => (user.value as { role?: string } | null)?.role === "admin")

// Customers can open an enquiry pre-linked to this Sage product.
const enquiryLink = computed(() => ({
	path: "/enquiries",
	query: {
		productSku: itemSourceKey.value,
		subject: `Enquiry about ${itemName.value}`,
		supplierName: item.value?.PreferredVendor?.trim() || "SupplyKey",
	},
}))

function valueOrDash(value: string | number | boolean | null | undefined) {
	if (value === null || value === undefined || value === "") {
		return "-"
	}

	if (typeof value === "boolean") {
		return value ? "Yes" : "No"
	}

	return String(value)
}

function formatDate(value: Date | string | null | undefined) {
	if (!value) {
		return "-"
	}

	const date = value instanceof Date ? value : new Date(value)
	if (Number.isNaN(date.getTime())) {
		return "-"
	}

	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(date)
}

function formatCatalogPrice(value: number | null | undefined) {
	if (typeof value !== "number") {
		return "-"
	}

	return formatPrice(Math.round(value * 100), currencyCode.value)
}

const inventoryRows = computed(() => [
	{ label: "Available", value: valueOrDash(item.value?.QuantityAvailable) },
	{ label: "On hand", value: valueOrDash(item.value?.QuantityOnHand) },
	{ label: "Committed", value: valueOrDash(item.value?.QuantityCommitted) },
	{ label: "On purchase order", value: valueOrDash(item.value?.QuantityOnPurchaseOrder) },
	{ label: "On sales order", value: valueOrDash(item.value?.QuantityOnSalesOrder) },
	{ label: "Stocking UOM", value: valueOrDash(item.value?.StockingUnitOfMeasure) },
	{ label: "Unit weight", value: valueOrDash(item.value?.UnitWeight) },
	{ label: "Weight UOM", value: valueOrDash(item.value?.WeightUnitOfMeasure) },
])

const detailRows = computed(() => [
	{ label: "Item number", value: valueOrDash(item.value?.ItemNumber || itemSourceKey.value) },
	{ label: "Product key", value: valueOrDash(itemSourceKey.value) },
	{ label: "Account set", value: valueOrDash(item.value?.AccountSetCode) },
	{ label: "Default price list", value: valueOrDash(item.value?.DefaultPriceListCode) },
	{ label: "Vendor item", value: valueOrDash(item.value?.PreferredVendorItem) },
	{ label: "Tariff code", value: valueOrDash(item.value?.TariffCode) },
	{ label: "Stock item", value: valueOrDash(item.value?.StockItem) },
	{ label: "Sellable", value: valueOrDash(item.value?.Sellable) },
	{ label: "Active", value: valueOrDash(item.value?.Status) },
	{ label: "Last maintained", value: formatDate(item.value?.DateLastMaintained) },
	{ label: "Inactive date", value: formatDate(item.value?.DateInactive) },
])

async function addToCart() {
	if (!item.value) {
		return
	}

	adding.value = true
	try {
		await cart.addItem(itemSourceKey.value, 1)
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
					v-if="item"
					class="space-y-2"
				>
					<div class="flex flex-wrap items-center gap-2">
						<p class="text-sm font-medium text-muted-foreground">
							{{ item.ItemNumber || itemSourceKey }}
						</p>

						<Badge variant="secondary">
							{{ stockLabel(itemStockStatus) }}
						</Badge>
					</div>

					<h1 class="max-w-4xl text-3xl font-semibold tracking-tight">
						{{ itemName }}
					</h1>

					<p class="text-sm text-muted-foreground">
						{{ itemCategory }} / {{ itemManufacturer }}
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

			<div
				v-if="item"
				class="flex flex-wrap items-center gap-2"
			>
				<Button
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

				<Button
					v-if="!isAdmin"
					as-child
					variant="outline"
				>
					<NuxtLink :to="enquiryLink">
						<MessageSquarePlus class="size-4" />
						Ask about this product
					</NuxtLink>
				</Button>
			</div>
		</div>

		<Alert
			v-if="error"
			variant="destructive"
		>
			<AlertCircle class="size-4" />

			<AlertTitle>Unable to load product</AlertTitle>

			<AlertDescription>
				We could not load the requested product detail.
			</AlertDescription>
		</Alert>

		<div
			v-else
			class="grid gap-6 xl:grid-cols-[minmax(18rem,24rem)_1fr]"
		>
			<Card class="overflow-hidden py-0">
				<div class="aspect-square bg-muted">
					<div class="flex size-full items-center justify-center text-muted-foreground">
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
								{{ itemDescription }}
							</p>

							<div
								v-if="comments.length"
								class="space-y-2"
							>
								<p class="text-sm font-medium">
									Product notes
								</p>

								<ul class="space-y-1 text-sm text-muted-foreground">
									<li
										v-for="comment in comments"
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
							<CardTitle>Product details</CardTitle>
						</CardHeader>

						<CardContent>
							<dl class="grid gap-3 sm:grid-cols-2">
								<div
									v-for="row in detailRows"
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
								Current price
							</p>

							<p
								v-if="unitPrice !== null"
								class="mt-1 text-3xl font-semibold tracking-tight"
							>
								{{ formatCatalogPrice(unitPrice) }}
							</p>

							<p
								v-else
								class="mt-1 text-lg font-semibold"
							>
								Price unavailable
							</p>

							<p class="mt-1 text-sm text-muted-foreground">
								Per {{ unitOfMeasure }}
							</p>
						</div>

						<Alert v-if="pricingUnavailableReason">
							<AlertCircle class="size-4" />

							<AlertTitle>Pricing not returned</AlertTitle>

							<AlertDescription>
								{{ pricingUnavailableReason }}
							</AlertDescription>
						</Alert>

						<dl class="space-y-3 text-sm">
							<div class="flex items-center justify-between gap-3">
								<dt class="text-muted-foreground">
									Currency
								</dt>

								<dd class="font-medium">
									{{ pricing?.CurrencyCode || "-" }}
								</dd>
							</div>

							<div class="flex items-center justify-between gap-3">
								<dt class="text-muted-foreground">
									Price list
								</dt>

								<dd class="font-medium">
									{{ pricing?.PriceListCode || item?.DefaultPriceListCode || "-" }}
								</dd>
							</div>

							<div class="flex items-center justify-between gap-3">
								<dt class="text-muted-foreground">
									Base price
								</dt>

								<dd class="font-medium">
									{{ formatCatalogPrice(pricing?.BasePrice) }}
								</dd>
							</div>

							<div class="flex items-center justify-between gap-3">
								<dt class="text-muted-foreground">
									Sale price
								</dt>

								<dd class="font-medium">
									{{ formatCatalogPrice(pricing?.SalePrice) }}
								</dd>
							</div>

							<div class="flex items-center justify-between gap-3">
								<dt class="text-muted-foreground">
									Sale starts
								</dt>

								<dd class="font-medium">
									{{ formatDate(pricing?.SaleStartDate) }}
								</dd>
							</div>

							<div class="flex items-center justify-between gap-3">
								<dt class="text-muted-foreground">
									Sale ends
								</dt>

								<dd class="font-medium">
									{{ formatDate(pricing?.SaleEndDate) }}
								</dd>
							</div>
						</dl>
					</CardContent>
				</Card>
			</div>
		</div>
	</div>
</template>
