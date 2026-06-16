<script setup lang="ts">
import { ArrowLeft, CheckCircle2, MapPin, Receipt, Truck } from "@lucide/vue"
import type { OrderDetail } from "#shared/types/order"

definePageMeta({
	layout: "dashboard",
	middleware: ["authenticated"],
})

const route = useRoute()
const orderNumber = computed(() => typeof route.params.number === "string" ? route.params.number : "")

const { data: order, pending, error } = await useFetch<OrderDetail>(() => `/api/orders/${orderNumber.value}`)

useHead({
	title: computed(() => order.value ? `Order ${order.value.orderNumber}` : "Order"),
})

function formatPrice(cents: number) {
	return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string) {
	const date = new Date(iso)
	return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function formatTime(iso: string) {
	const date = new Date(iso)
	return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

const statusColors: Record<string, string> = {
	placed: "bg-primary text-primary-foreground",
	processing: "bg-chart-4 text-primary",
	shipped: "bg-accent text-accent-foreground",
	delivered: "bg-success text-success-foreground",
}

const paymentLabels: Record<string, string> = {
	invoice_net30: "Invoice · Net 30",
	purchase_order: "Purchase Order",
	corporate_account: "Corporate Account",
}

const carrierLabels: Record<string, string> = {
	arrange_best: "Arrange best available",
	customer_carrier: "Use our carrier",
	customer_pickup: "Customer pickup",
	heavy_freight: "Heavy Freight LTL",
	express_courier: "Express Courier",
	standard_logistics: "Standard Logistics",
}
</script>

<template>
	<div class="space-y-8">
		<NuxtLink
			to="/dashboard"
			class="text-muted-foreground hover:text-primary inline-flex items-center gap-2 text-[0.68rem] font-bold tracking-[0.16em] uppercase transition-colors"
		>
			<ArrowLeft class="size-3.5" />
			Back to Dashboard
		</NuxtLink>

		<div
			v-if="pending"
			class="border-border/60 bg-card rounded-md border p-12 text-center"
		>
			<p class="text-muted-foreground text-sm">
				Loading order…
			</p>
		</div>

		<div
			v-else-if="error || !order"
			class="border-destructive/30 bg-destructive/5 rounded-md border p-8 text-center"
		>
			<p class="text-destructive text-sm">
				Unable to load order. It may have been removed or you may not have access.
			</p>

			<NuxtLink
				to="/dashboard"
				class="bg-primary text-primary-foreground mt-4 inline-flex rounded-md px-4 py-2 text-[0.68rem] font-bold tracking-[0.15em] uppercase transition-all hover:brightness-110"
			>
				Return
			</NuxtLink>
		</div>

		<template v-else>
			<section class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div class="space-y-3">
					<div class="flex items-center gap-3">
						<div class="bg-success/10 text-success flex size-14 items-center justify-center rounded-md">
							<CheckCircle2 class="size-8" />
						</div>

						<div>
							<p class="text-muted-foreground text-[0.68rem] font-bold tracking-[0.24em] uppercase">
								Order Confirmed
							</p>

							<h1
								class="text-foreground text-4xl font-extrabold tracking-[-0.035em]"
								style="font-family: var(--font-display);"
							>
								{{ order.orderNumber }}
							</h1>
						</div>
					</div>

					<p class="text-muted-foreground max-w-xl text-sm leading-7">
						Order details have been received. Shipping and availability will be confirmed before release.
					</p>
				</div>

				<span
					class="inline-flex items-center rounded-sm px-3 py-1.5 text-[0.62rem] font-bold tracking-[0.16em] uppercase"
					:class="statusColors[order.status] ?? 'bg-muted text-foreground'"
				>
					{{ order.status }}
				</span>
			</section>

			<section class="grid gap-4 md:grid-cols-3">
				<div class="border-border/60 bg-card rounded-md border p-5">
					<div class="text-muted-foreground flex items-center gap-2">
						<MapPin class="size-4" />

						<p class="text-[0.62rem] font-bold tracking-[0.18em] uppercase">
							Delivery Site
						</p>
					</div>

					<p class="text-foreground mt-3 text-sm font-semibold">
						{{ order.deliverySite }}
					</p>
				</div>

				<div class="border-border/60 bg-card rounded-md border p-5">
					<div class="text-muted-foreground flex items-center gap-2">
						<Truck class="size-4" />

						<p class="text-[0.62rem] font-bold tracking-[0.18em] uppercase">
							Carrier preference
						</p>
					</div>

					<p class="text-foreground mt-3 text-sm font-semibold">
						{{ carrierLabels[order.carrier] ?? order.carrier }}
					</p>
				</div>

				<div class="border-border/60 bg-card rounded-md border p-5">
					<div class="text-muted-foreground flex items-center gap-2">
						<Receipt class="size-4" />

						<p class="text-[0.62rem] font-bold tracking-[0.18em] uppercase">
							Payment
						</p>
					</div>

					<p class="text-foreground mt-3 text-sm font-semibold">
						{{ paymentLabels[order.paymentMethod] ?? order.paymentMethod }}
					</p>

					<p
						v-if="order.poNumber"
						class="text-muted-foreground mt-1 text-xs"
					>
						PO: {{ order.poNumber }}
					</p>
				</div>
			</section>

			<section class="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
				<div class="border-border/60 bg-card rounded-md border p-6">
					<div class="mb-5 flex items-center justify-between">
						<h2
							class="text-foreground text-lg font-extrabold tracking-[-0.015em]"
							style="font-family: var(--font-display);"
						>
							Line Items
						</h2>

						<span class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
							{{ order.lines.length }} SKU{{ order.lines.length === 1 ? "" : "s" }}
						</span>
					</div>

					<ul class="space-y-3">
						<li
							v-for="line in order.lines"
							:key="line.id"
							class="bg-muted flex items-center gap-4 rounded-md p-4"
						>
							<div class="min-w-0 flex-1">
								<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.14em] uppercase">
									{{ line.sku }}
								</p>

								<p class="text-foreground mt-1 truncate text-sm font-semibold">
									{{ line.name }}
								</p>

								<p class="text-muted-foreground mt-1 text-xs">
									{{ line.quantity }} × {{ formatPrice(line.unitPriceCents) }}
								</p>
							</div>

							<p
								class="metric-value text-foreground w-28 text-right text-lg font-extrabold"
								style="font-family: var(--font-display);"
							>
								{{ formatPrice(line.lineTotalCents) }}
							</p>
						</li>
					</ul>
				</div>

				<aside class="space-y-4">
					<div class="border-border/60 bg-card rounded-md border p-6">
						<p
							class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase"
							style="font-family: var(--font-display);"
						>
							Totals
						</p>

						<dl class="mt-5 space-y-3 text-sm">
							<div class="flex items-center justify-between">
								<dt class="text-muted-foreground">
									Subtotal
								</dt>

								<dd class="text-foreground font-semibold tabular-nums">
									{{ formatPrice(order.subtotalCents) }}
								</dd>
							</div>

							<div class="flex items-center justify-between">
								<dt class="text-muted-foreground">
									Logistics
								</dt>

								<dd class="text-foreground font-semibold tabular-nums">
									{{ formatPrice(order.shippingCents) }}
								</dd>
							</div>

							<div class="flex items-center justify-between">
								<dt class="text-muted-foreground">
									Environmental Tax
								</dt>

								<dd class="text-foreground font-semibold tabular-nums">
									{{ formatPrice(order.taxCents) }}
								</dd>
							</div>
						</dl>

						<div class="border-border/60 mt-5 border-t pt-5">
							<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
								Grand Total
							</p>

							<p
								class="metric-value text-foreground mt-2 text-4xl font-extrabold"
								style="font-family: var(--font-display);"
							>
								{{ formatPrice(order.totalCents) }}
							</p>
						</div>
					</div>

					<div class="border-border/60 bg-card rounded-md border p-5">
						<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
							Placed
						</p>

						<p class="text-foreground mt-2 text-sm font-semibold">
							{{ formatDate(order.placedAt) }}
						</p>

						<p class="text-muted-foreground text-xs">
							{{ formatTime(order.placedAt) }}
						</p>
					</div>
				</aside>
			</section>
		</template>
	</div>
</template>
