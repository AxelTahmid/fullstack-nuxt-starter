<script setup lang="ts">
import { CheckCircle2, LoaderCircle, Minus, Plus, ShieldCheck, Trash2, Truck } from "@lucide/vue"
import type { FetchError } from "ofetch"
import type { CheckoutResponse } from "#shared/types/order"
import { toast } from "~/components/toast"
import { useCart } from "~/composables/useCart"

definePageMeta({
	layout: "dashboard",
	middleware: ["authenticated"],
})

useHead({
	title: "Cart",
})

const cart = useCart()
await cart.refresh()

const deliverySite = ref("")
const deliveryContact = ref("")
const requestedShipDate = ref("")
const shippingInstructions = ref("")
const carrier = ref<"arrange_best" | "customer_carrier" | "customer_pickup">("arrange_best")
const paymentMethod = ref<"invoice_net30" | "purchase_order" | "corporate_account">("invoice_net30")
const poNumber = ref("")
const isSubmitting = ref(false)
const updatingId = ref<number | null>(null)

const carriers = [
	{ value: "arrange_best", label: "Arrange best available", detail: "Confirm carrier, route, and freight cost before release." },
	{ value: "customer_carrier", label: "Use our carrier", detail: "Provide carrier account and pickup instructions below." },
	{ value: "customer_pickup", label: "Customer pickup", detail: "Hold for pickup after availability is confirmed." },
] as const

const paymentOptions = [
	{ value: "invoice_net30", label: "Invoice · Net 30", detail: "Company account on file" },
	{ value: "purchase_order", label: "Purchase Order", detail: "Requires PO number" },
	{ value: "corporate_account", label: "Corporate Account", detail: "Direct debit authorization" },
] as const

const displayedShippingCents = computed(() => cart.summary.value.shippingCents)
const displayedSubtotalCents = computed(() => cart.summary.value.subtotalCents)
const displayedTaxCents = computed(() => Math.round(displayedSubtotalCents.value * 0.015))
const displayedTotalCents = computed(() => displayedSubtotalCents.value + displayedShippingCents.value + displayedTaxCents.value)
const shippingCostLabel = computed(() => displayedShippingCents.value > 0 ? formatPrice(displayedShippingCents.value) : "To be confirmed")

function formatPrice(cents: number) {
	return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function adjustQuantity(id: number, delta: number) {
	const line = cart.summary.value.lines.find(l => l.id === id)
	if (!line)
		return

	const next = Math.max(0, line.quantity + delta)
	updatingId.value = id
	try {
		await cart.updateQuantity(id, next)
	}
	catch {
		toast.error("Unable to update quantity.")
	}
	finally {
		updatingId.value = null
	}
}

async function removeLine(id: number) {
	updatingId.value = id
	try {
		await cart.removeItem(id)
		toast.success("Removed from cart.")
	}
	catch {
		toast.error("Unable to remove item.")
	}
	finally {
		updatingId.value = null
	}
}

async function placeOrder() {
	if (!cart.summary.value.lines.length) {
		toast.error("Cart is empty.")
		return
	}
	if (!deliverySite.value.trim()) {
		toast.error("Delivery site is required.")
		return
	}
	if (paymentMethod.value === "purchase_order" && !poNumber.value.trim()) {
		toast.error("PO number is required for Purchase Order payment.")
		return
	}

	isSubmitting.value = true
	try {
		const response = await $fetch<CheckoutResponse>("/api/orders", {
			method: "POST",
			body: {
				deliverySite: deliverySite.value.trim(),
				carrier: carrier.value,
				deliveryContact: deliveryContact.value.trim() || undefined,
				requestedShipDate: requestedShipDate.value || undefined,
				shippingInstructions: shippingInstructions.value.trim() || undefined,
				paymentMethod: paymentMethod.value,
				poNumber: poNumber.value.trim() || undefined,
			},
		})
		toast.success(`Order ${response.orderNumber} placed.`)
		await navigateTo(`/orders/${response.orderNumber}`)
	}
	catch (error) {
		const fetchError = error as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to place order.")
	}
	finally {
		isSubmitting.value = false
	}
}
</script>

<template>
	<div class="space-y-8">
		<section class="space-y-2">
			<p class="text-muted-foreground text-[0.68rem] font-bold tracking-[0.24em] uppercase">
				Checkout
			</p>

			<h1
				class="text-foreground text-5xl font-extrabold tracking-[-0.045em]"
				style="font-family: var(--font-display);"
			>
				Cart
			</h1>

			<p class="text-muted-foreground max-w-2xl text-sm leading-7">
				Review line items, add shipping details, and choose payment terms.
			</p>
		</section>

		<section class="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
			<div class="space-y-6">
				<div class="border-border/60 bg-card rounded-md border p-6">
					<div class="mb-5 flex items-center justify-between">
						<h2
							class="text-foreground text-lg font-extrabold tracking-[-0.015em]"
							style="font-family: var(--font-display);"
						>
							Cart Items
						</h2>

						<span class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
							{{ cart.summary.value.itemCount }} Units
						</span>
					</div>

					<div
						v-if="!cart.summary.value.lines.length"
						class="bg-muted rounded-md p-8 text-center"
					>
						<p class="text-muted-foreground text-sm">
							Cart is empty.
						</p>

						<Button
							as-child
							class="bg-primary text-primary-foreground mt-4 inline-flex rounded-md px-4 py-2 text-[0.68rem] font-bold tracking-[0.15em] uppercase transition-all hover:brightness-110"
						>
							<NuxtLink to="/shop">
								Browse Catalog
							</NuxtLink>
						</Button>
					</div>

					<ul
						v-else
						class="space-y-3"
					>
						<li
							v-for="line in cart.summary.value.lines"
							:key="line.id"
							class="bg-muted flex items-center gap-4 rounded-md p-4"
						>
							<div class="bg-background size-20 shrink-0 overflow-hidden rounded-md">
								<img
									v-if="line.imageUrl"
									:src="line.imageUrl"
									:alt="line.name"
									class="size-full object-cover"
								>
							</div>

							<div class="min-w-0 flex-1">
								<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.14em] uppercase">
									{{ line.manufacturer }} · {{ line.sku }}
								</p>

								<p class="text-foreground mt-1 truncate text-sm font-semibold">
									{{ line.name }}
								</p>

								<p class="text-muted-foreground mt-1 text-xs">
									{{ formatPrice(line.unitPriceCents) }} / unit
								</p>
							</div>

							<div class="flex items-center gap-2">
								<Button
									type="button"
									class="border-border/70 text-muted-foreground hover:border-primary hover:text-primary flex size-8 items-center justify-center rounded-md border transition-all disabled:opacity-60"
									:disabled="updatingId === line.id"
									@click="adjustQuantity(line.id, -1)"
								>
									<Minus class="size-3.5" />
								</Button>

								<span class="min-w-8 text-center text-sm font-bold tabular-nums">
									{{ updatingId === line.id ? "…" : line.quantity }}
								</span>

								<Button
									type="button"
									class="border-border/70 text-muted-foreground hover:border-primary hover:text-primary flex size-8 items-center justify-center rounded-md border transition-all disabled:opacity-60"
									:disabled="updatingId === line.id"
									@click="adjustQuantity(line.id, 1)"
								>
									<Plus class="size-3.5" />
								</Button>
							</div>

							<div class="w-24 text-right">
								<p
									class="metric-value text-foreground text-lg font-extrabold"
									style="font-family: var(--font-display);"
								>
									{{ formatPrice(line.lineTotalCents) }}
								</p>
							</div>

							<Button
								type="button"
								class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex size-8 items-center justify-center rounded-md transition-all disabled:opacity-60"
								:disabled="updatingId === line.id"
								@click="removeLine(line.id)"
							>
								<Trash2 class="size-4" />
							</Button>
						</li>
					</ul>
				</div>

				<div class="border-border/60 bg-card rounded-md border p-6">
					<h2
						class="text-foreground mb-5 text-lg font-extrabold tracking-[-0.015em]"
						style="font-family: var(--font-display);"
					>
						Shipping
					</h2>

					<div class="space-y-5">
						<div class="grid gap-4 md:grid-cols-2">
							<div>
								<Label class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
									Delivery site
								</Label>

								<Input
									v-model="deliverySite"
									type="text"
									placeholder="Receiving address, yard, or site"
									class="bg-muted text-foreground placeholder:text-muted-foreground/60 focus:ring-primary/50 mt-2 w-full rounded-md px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
								/>
							</div>

							<div>
								<Label class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
									Delivery contact
								</Label>

								<Input
									v-model="deliveryContact"
									type="text"
									placeholder="Name, phone, or receiving desk"
									class="bg-muted text-foreground placeholder:text-muted-foreground/60 focus:ring-primary/50 mt-2 w-full rounded-md px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
								/>
							</div>
						</div>

						<div>
							<Label class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
								Requested ship date
							</Label>

							<Input
								v-model="requestedShipDate"
								type="date"
								class="bg-muted text-foreground focus:ring-primary/50 mt-2 w-full rounded-md px-3 py-2.5 text-sm focus:ring-2 focus:outline-none md:max-w-xs"
							/>
						</div>

						<div>
							<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
								Carrier preference
							</p>

							<div class="mt-3 space-y-2">
								<Button
									v-for="option in carriers"
									:key="option.value"
									type="button"
									class="bg-muted flex h-auto w-full cursor-pointer items-center gap-4 rounded-md p-4 text-left transition-all"
									:class="{ 'ring-primary ring-2': carrier === option.value }"
									@click="carrier = option.value"
								>
									<Truck class="text-muted-foreground size-5" />

									<div class="flex-1">
										<p class="text-foreground text-sm font-semibold">
											{{ option.label }}
										</p>

										<p class="text-muted-foreground text-xs">
											{{ option.detail }}
										</p>
									</div>
								</Button>
							</div>
						</div>

						<div>
							<Label class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
								Shipping instructions
							</Label>

							<Textarea
								v-model="shippingInstructions"
								placeholder="Dock hours, carrier account, liftgate needs, site access, or handling notes"
								class="bg-muted text-foreground placeholder:text-muted-foreground/60 focus:ring-primary/50 mt-2 min-h-24 w-full rounded-md px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
							/>
						</div>
					</div>
				</div>

				<div class="border-border/60 bg-card rounded-md border p-6">
					<h2
						class="text-foreground mb-5 text-lg font-extrabold tracking-[-0.015em]"
						style="font-family: var(--font-display);"
					>
						Payment Protocol
					</h2>

					<div class="space-y-3">
						<Button
							v-for="option in paymentOptions"
							:key="option.value"
							type="button"
							class="bg-muted flex h-auto w-full cursor-pointer items-center gap-4 rounded-md p-4 text-left transition-all"
							:class="{ 'ring-primary ring-2': paymentMethod === option.value }"
							@click="paymentMethod = option.value"
						>
							<div class="flex-1">
								<p class="text-foreground text-sm font-semibold">
									{{ option.label }}
								</p>

								<p class="text-muted-foreground text-xs">
									{{ option.detail }}
								</p>
							</div>
						</Button>
					</div>

					<div
						v-if="paymentMethod === 'purchase_order'"
						class="mt-5"
					>
						<Label class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
							PO Number
						</Label>

						<Input
							v-model="poNumber"
							type="text"
							placeholder="PO-2026-00042"
							class="bg-muted text-foreground placeholder:text-muted-foreground/60 focus:ring-primary/50 mt-2 w-full rounded-md px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
						/>
					</div>
				</div>
			</div>

			<aside class="space-y-4 xl:sticky xl:top-24 xl:self-start">
				<div class="border-primary/20 bg-primary text-primary-foreground rounded-md border p-6">
					<p
						class="text-primary-foreground/70 text-[0.62rem] font-bold tracking-[0.2em] uppercase"
						style="font-family: var(--font-display);"
					>
						Order Summary
					</p>

					<dl class="mt-5 space-y-3 text-sm">
						<div class="flex items-center justify-between">
							<dt class="text-primary-foreground/70">
								Subtotal
							</dt>

							<dd class="font-semibold tabular-nums">
								{{ formatPrice(displayedSubtotalCents) }}
							</dd>
						</div>

						<div class="flex items-center justify-between">
							<dt class="text-primary-foreground/70">
								Shipping
							</dt>

							<dd class="font-semibold tabular-nums">
								{{ shippingCostLabel }}
							</dd>
						</div>

						<div class="flex items-center justify-between">
							<dt class="text-primary-foreground/70">
								Estimated tax
							</dt>

							<dd class="font-semibold tabular-nums">
								{{ formatPrice(displayedTaxCents) }}
							</dd>
						</div>
					</dl>

					<div class="border-primary-foreground/20 mt-5 border-t pt-5">
						<p class="text-primary-foreground/70 text-[0.62rem] font-bold tracking-[0.2em] uppercase">
							Estimated total
						</p>

						<p
							class="metric-value mt-2 text-4xl font-extrabold"
							style="font-family: var(--font-display);"
						>
							{{ formatPrice(displayedTotalCents) }}
						</p>
					</div>

					<Button
						type="button"
						class="bg-primary-foreground text-primary mt-6 flex w-full items-center justify-center gap-2 rounded-md px-4 py-3.5 text-[0.72rem] font-extrabold tracking-[0.18em] uppercase transition-all hover:brightness-95 disabled:opacity-60"
						:disabled="isSubmitting || !cart.summary.value.lines.length"
						style="font-family: var(--font-display);"
						@click="placeOrder"
					>
						<LoaderCircle
							v-if="isSubmitting"
							class="size-4 animate-spin"
						/>

						<CheckCircle2
							v-else
							class="size-4"
						/>
						{{ isSubmitting ? "Submitting…" : "Place Order" }}
					</Button>
				</div>

				<div class="border-border/60 bg-card rounded-md border p-5">
					<div class="flex items-start gap-3">
						<ShieldCheck class="text-primary size-5 shrink-0" />

						<div>
							<p
								class="text-foreground text-xs font-bold tracking-[0.08em]"
								style="font-family: var(--font-display);"
							>
								ISO 9001 · Priority Support
							</p>

							<p class="text-muted-foreground mt-1 text-xs">
								All SupplyKey line items ship with compliance documentation. Priority dispatch for critical-path operations.
							</p>
						</div>
					</div>
				</div>
			</aside>
		</section>
	</div>
</template>
