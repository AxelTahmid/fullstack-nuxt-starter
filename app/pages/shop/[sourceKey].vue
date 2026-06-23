<script setup lang="ts">
import { AlertCircle, ArrowLeft, Check, LoaderCircle, MessageSquarePlus, Plus } from "@lucide/vue"
import type { FetchError } from "ofetch"
import type { ICItemPricingDetailT, ICItemPricingT, ICItemT } from "#shared/sage300"
import type { ProductImage, StockStatus } from "#shared/types/product"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { NumberField, NumberFieldContent, NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput } from "@/components/ui/number-field"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "~/components/toast"
import { useCart } from "~/composables/useCart"
import { formatPrice, stockLabel } from "./_lib/format"
import ProductImages from "./_lib/ProductImages.vue"

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
	images: ProductImage[]
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
const stockBadgeVariant = computed(() => {
	if (itemStockStatus.value === "out_of_stock") {
		return "destructive" as const
	}
	if (itemStockStatus.value === "low_stock") {
		return "secondary" as const
	}
	return "default" as const
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
const quantity = ref(1)

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
	{ label: "Category", value: itemCategory.value },
	{ label: "Manufacturer", value: itemManufacturer.value },
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

const pricingRows = computed(() => [
	{ label: "Currency", value: pricing.value?.CurrencyCode || "-" },
	{ label: "Price list", value: pricing.value?.PriceListCode || item.value?.DefaultPriceListCode || "-" },
	{ label: "Base price", value: formatCatalogPrice(pricing.value?.BasePrice) },
	{ label: "Sale price", value: formatCatalogPrice(pricing.value?.SalePrice) },
	{ label: "Sale starts", value: formatDate(pricing.value?.SaleStartDate) },
	{ label: "Sale ends", value: formatDate(pricing.value?.SaleEndDate) },
])

async function addToCart() {
	if (!item.value) {
		return
	}

	adding.value = true
	try {
		await cart.addItem(itemSourceKey.value, Math.max(1, quantity.value))
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
	<div class="space-y-8">
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

		<template v-else>
			<!-- Hero: gallery + buy box -->
			<div class="grid gap-8 lg:grid-cols-2">
				<ProductImages
					:source-key="itemSourceKey"
					:product-name="itemName"
					:is-admin="isAdmin"
					:initial-images="data?.images ?? []"
				/>

				<div
					v-if="item"
					class="space-y-6"
				>
					<div class="space-y-2">
						<div class="flex flex-wrap items-center gap-2">
							<span class="text-muted-foreground font-mono text-sm">
								{{ item.ItemNumber || itemSourceKey }}
							</span>

							<Badge :variant="stockBadgeVariant">
								{{ stockLabel(itemStockStatus) }}
							</Badge>
						</div>

						<h1 class="text-3xl font-semibold tracking-tight">
							{{ itemName }}
						</h1>

						<p class="text-muted-foreground text-sm">
							{{ itemCategory }} · {{ itemManufacturer }}
						</p>
					</div>

					<Separator />

					<div class="space-y-1">
						<p
							v-if="unitPrice !== null"
							class="text-4xl font-semibold tracking-tight tabular-nums"
						>
							{{ formatCatalogPrice(unitPrice) }}
						</p>

						<p
							v-else
							class="text-2xl font-semibold"
						>
							Price unavailable
						</p>

						<p class="text-muted-foreground text-sm">
							Per {{ unitOfMeasure }}<span v-if="pricing?.PriceListCode || item.DefaultPriceListCode"> · Price list {{ pricing?.PriceListCode || item.DefaultPriceListCode }}</span>
						</p>
					</div>

					<Alert v-if="pricingUnavailableReason">
						<AlertCircle class="size-4" />

						<AlertTitle>Pricing not returned</AlertTitle>

						<AlertDescription>
							{{ pricingUnavailableReason }}
						</AlertDescription>
					</Alert>

					<div
						v-if="!isAdmin"
						class="flex flex-wrap items-center gap-3"
					>
						<NumberField
							v-model="quantity"
							:min="1"
							:default-value="1"
							class="w-32"
						>
							<NumberFieldContent>
								<NumberFieldDecrement />

								<NumberFieldInput />

								<NumberFieldIncrement />
							</NumberFieldContent>
						</NumberField>

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
							as-child
							variant="outline"
						>
							<NuxtLink :to="enquiryLink">
								<MessageSquarePlus class="size-4" />
								Ask about this product
							</NuxtLink>
						</Button>
					</div>

					<Separator />

					<p class="text-muted-foreground text-sm leading-6">
						{{ itemDescription }}
					</p>
				</div>

				<div
					v-else
					class="space-y-5"
				>
					<Skeleton class="h-4 w-28" />

					<Skeleton class="h-9 w-3/4" />

					<Skeleton class="h-4 w-40" />

					<Skeleton class="h-12 w-44" />

					<Skeleton class="h-10 w-full max-w-sm" />
				</div>
			</div>

			<!-- Detail tabs -->
			<Tabs
				v-if="item"
				default-value="overview"
				class="w-full"
			>
				<TabsList>
					<TabsTrigger value="overview">
						Overview
					</TabsTrigger>

					<TabsTrigger value="specifications">
						Specifications
					</TabsTrigger>

					<TabsTrigger value="inventory">
						Inventory
					</TabsTrigger>

					<TabsTrigger value="pricing">
						Pricing
					</TabsTrigger>
				</TabsList>

				<TabsContent value="overview">
					<div class="max-w-3xl space-y-4 py-2">
						<p class="text-sm leading-7">
							{{ itemDescription }}
						</p>

						<div
							v-if="comments.length"
							class="space-y-2"
						>
							<p class="text-sm font-medium">
								Product notes
							</p>

							<ul class="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
								<li
									v-for="comment in comments"
									:key="comment"
								>
									{{ comment }}
								</li>
							</ul>
						</div>
					</div>
				</TabsContent>

				<TabsContent value="specifications">
					<dl class="max-w-3xl divide-y py-2">
						<div
							v-for="row in detailRows"
							:key="row.label"
							class="flex items-start justify-between gap-6 py-2.5"
						>
							<dt class="text-muted-foreground text-sm">
								{{ row.label }}
							</dt>

							<dd class="text-right text-sm font-medium wrap-break-word">
								{{ row.value }}
							</dd>
						</div>
					</dl>
				</TabsContent>

				<TabsContent value="inventory">
					<dl class="max-w-3xl divide-y py-2">
						<div
							v-for="row in inventoryRows"
							:key="row.label"
							class="flex items-center justify-between gap-6 py-2.5"
						>
							<dt class="text-muted-foreground text-sm">
								{{ row.label }}
							</dt>

							<dd class="text-sm font-medium tabular-nums">
								{{ row.value }}
							</dd>
						</div>
					</dl>
				</TabsContent>

				<TabsContent value="pricing">
					<dl class="max-w-3xl divide-y py-2">
						<div
							v-for="row in pricingRows"
							:key="row.label"
							class="flex items-center justify-between gap-6 py-2.5"
						>
							<dt class="text-muted-foreground text-sm">
								{{ row.label }}
							</dt>

							<dd class="text-sm font-medium tabular-nums">
								{{ row.value }}
							</dd>
						</div>
					</dl>
				</TabsContent>
			</Tabs>
		</template>
	</div>
</template>
