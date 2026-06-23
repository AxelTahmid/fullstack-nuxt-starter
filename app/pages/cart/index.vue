<script setup lang="ts">
import { CheckCircle2, FileText, ImageIcon, LoaderCircle, Minus, Plus, Trash2 } from "@lucide/vue"
import type { FetchError } from "ofetch"
import type { EstimateResponse } from "#shared/types/estimate"
import type { CheckoutResponse } from "#shared/types/order"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "~/components/toast"
import { useCart } from "~/composables/useCart"

definePageMeta({
	layout: "dashboard",
	middleware: ["authenticated", "customer"],
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
const isRequestingEstimate = ref(false)
const updatingId = ref<number | null>(null)

const carriers = [
	{ value: "arrange_best", label: "Arrange best available" },
	{ value: "customer_carrier", label: "Use our carrier account" },
	{ value: "customer_pickup", label: "Customer pickup" },
] as const

const paymentOptions = [
	{ value: "invoice_net30", label: "Invoice · Net 30" },
	{ value: "purchase_order", label: "Purchase order" },
	{ value: "corporate_account", label: "Corporate account" },
] as const

const hasItems = computed(() => cart.summary.value.lines.length > 0)
const subtotalCents = computed(() => cart.summary.value.subtotalCents)

function formatPrice(cents: number) {
	return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function adjustQuantity(id: number, delta: number) {
	const line = cart.summary.value.lines.find(l => l.id === id)
	if (!line) {
		return
	}

	updatingId.value = id
	try {
		// Dropping below 1 removes the line rather than leaving a zero-quantity item.
		if (line.quantity + delta < 1) {
			await cart.removeItem(id)
			toast.success("Removed from cart.")
		}
		else {
			await cart.updateQuantity(id, line.quantity + delta)
		}
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

function validateForSubmit() {
	if (!hasItems.value) {
		toast.error("Cart is empty.")
		return false
	}
	if (!deliverySite.value.trim()) {
		toast.error("Delivery site is required.")
		return false
	}
	return true
}

async function placeOrder() {
	if (!validateForSubmit()) {
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

async function requestEstimate() {
	if (!validateForSubmit()) {
		return
	}

	isRequestingEstimate.value = true
	try {
		// Items are omitted so the server builds the quote from the current cart.
		const response = await $fetch<EstimateResponse>("/api/estimates", {
			method: "POST",
			body: {
				deliverySite: deliverySite.value.trim(),
				deliveryContact: deliveryContact.value.trim() || undefined,
				requestedShipDate: requestedShipDate.value || undefined,
				notes: shippingInstructions.value.trim() || undefined,
			},
		})
		toast.success(`Estimate ${response.quoteNumber} requested.`)
		await navigateTo(`/estimate/${response.quoteNumber}`)
	}
	catch (error) {
		const fetchError = error as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to request estimate.")
	}
	finally {
		isRequestingEstimate.value = false
	}
}
</script>

<template>
	<div class="space-y-6">
		<div class="space-y-1">
			<h1 class="text-2xl font-semibold tracking-tight">
				Cart
			</h1>

			<p class="text-muted-foreground text-sm">
				Review line items, then place an order or request an estimate. Final pricing, shipping, and tax are confirmed by SupplyKey.
			</p>
		</div>

		<div class="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
			<div class="space-y-6">
				<Card>
					<CardHeader class="flex-row items-center justify-between">
						<CardTitle>Items</CardTitle>

						<span class="text-muted-foreground text-sm">
							{{ cart.summary.value.itemCount }} unit{{ cart.summary.value.itemCount === 1 ? "" : "s" }}
						</span>
					</CardHeader>

					<CardContent>
						<div
							v-if="!hasItems"
							class="bg-muted/50 flex flex-col items-center gap-3 rounded-lg p-8 text-center"
						>
							<p class="text-muted-foreground text-sm">
								Your cart is empty.
							</p>

							<Button
								as-child
								variant="outline"
								size="sm"
							>
								<NuxtLink to="/shop">
									Browse catalog
								</NuxtLink>
							</Button>
						</div>

						<ul
							v-else
							class="divide-y"
						>
							<li
								v-for="line in cart.summary.value.lines"
								:key="line.id"
								class="flex items-center gap-4 py-4 first:pt-0 last:pb-0"
							>
								<div class="bg-muted text-muted-foreground flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border">
									<img
										v-if="line.imageUrl"
										:src="line.imageUrl"
										:alt="line.name"
										class="size-full object-cover"
									>

									<ImageIcon
										v-else
										class="size-5"
									/>
								</div>

								<div class="min-w-0 flex-1">
									<p class="text-muted-foreground font-mono text-xs">
										{{ line.manufacturer }} · {{ line.sku }}
									</p>

									<p class="truncate text-sm font-medium">
										{{ line.name }}
									</p>

									<p class="text-muted-foreground text-xs">
										{{ formatPrice(line.unitPriceCents) }} / unit
									</p>
								</div>

								<div class="flex items-center gap-1">
									<Button
										type="button"
										variant="outline"
										size="icon-sm"
										:disabled="updatingId === line.id"
										@click="adjustQuantity(line.id, -1)"
									>
										<Minus class="size-3.5" />
									</Button>

									<span class="w-8 text-center text-sm font-medium tabular-nums">
										{{ updatingId === line.id ? "…" : line.quantity }}
									</span>

									<Button
										type="button"
										variant="outline"
										size="icon-sm"
										:disabled="updatingId === line.id"
										@click="adjustQuantity(line.id, 1)"
									>
										<Plus class="size-3.5" />
									</Button>
								</div>

								<p class="w-24 text-right text-sm font-semibold tabular-nums">
									{{ formatPrice(line.lineTotalCents) }}
								</p>

								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									class="text-muted-foreground hover:text-destructive"
									:disabled="updatingId === line.id"
									@click="removeLine(line.id)"
								>
									<Trash2 class="size-4" />
								</Button>
							</li>
						</ul>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Delivery</CardTitle>
					</CardHeader>

					<CardContent class="space-y-4">
						<div class="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel for="delivery-site">
									Delivery site
								</FieldLabel>

								<Input
									id="delivery-site"
									v-model="deliverySite"
									placeholder="Receiving address, yard, or site"
								/>
							</Field>

							<Field>
								<FieldLabel for="delivery-contact">
									Delivery contact
								</FieldLabel>

								<Input
									id="delivery-contact"
									v-model="deliveryContact"
									placeholder="Name, phone, or receiving desk"
								/>
							</Field>

							<Field>
								<FieldLabel for="ship-date">
									Requested ship date
								</FieldLabel>

								<Input
									id="ship-date"
									v-model="requestedShipDate"
									type="date"
								/>
							</Field>

							<Field>
								<FieldLabel for="carrier">
									Carrier preference
								</FieldLabel>

								<NativeSelect
									id="carrier"
									v-model="carrier"
								>
									<option
										v-for="option in carriers"
										:key="option.value"
										:value="option.value"
									>
										{{ option.label }}
									</option>
								</NativeSelect>
							</Field>
						</div>

						<Field>
							<FieldLabel for="ship-instructions">
								Shipping instructions
							</FieldLabel>

							<Textarea
								id="ship-instructions"
								v-model="shippingInstructions"
								placeholder="Dock hours, carrier account, liftgate needs, site access, or handling notes"
							/>
						</Field>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Payment</CardTitle>
					</CardHeader>

					<CardContent class="space-y-4">
						<Field>
							<FieldLabel for="payment-method">
								Payment method
							</FieldLabel>

							<NativeSelect
								id="payment-method"
								v-model="paymentMethod"
							>
								<option
									v-for="option in paymentOptions"
									:key="option.value"
									:value="option.value"
								>
									{{ option.label }}
								</option>
							</NativeSelect>
						</Field>

						<Field v-if="paymentMethod === 'purchase_order'">
							<FieldLabel for="po-number">
								PO number
							</FieldLabel>

							<Input
								id="po-number"
								v-model="poNumber"
								placeholder="PO-2026-00042"
							/>
						</Field>
					</CardContent>
				</Card>
			</div>

			<div class="xl:sticky xl:top-6 xl:self-start">
				<Card>
					<CardHeader>
						<CardTitle>Summary</CardTitle>
					</CardHeader>

					<CardContent class="space-y-4">
						<dl class="space-y-2 text-sm">
							<div class="flex items-center justify-between">
								<dt class="text-muted-foreground">
									Subtotal
								</dt>

								<dd class="font-medium tabular-nums">
									{{ formatPrice(subtotalCents) }}
								</dd>
							</div>

							<div class="flex items-center justify-between">
								<dt class="text-muted-foreground">
									Shipping
								</dt>

								<dd class="text-muted-foreground">
									Confirmed at processing
								</dd>
							</div>

							<div class="flex items-center justify-between">
								<dt class="text-muted-foreground">
									Tax
								</dt>

								<dd class="text-muted-foreground">
									Confirmed at processing
								</dd>
							</div>
						</dl>

						<Separator />

						<div class="flex items-center justify-between">
							<span class="text-sm font-medium">Estimated total</span>

							<span class="text-2xl font-semibold tabular-nums">
								{{ formatPrice(subtotalCents) }}
							</span>
						</div>

						<p class="text-muted-foreground text-xs">
							Goods subtotal only. Shipping and tax are added when SupplyKey confirms the order or quote.
						</p>

						<div class="space-y-2 pt-1">
							<Button
								type="button"
								class="w-full"
								:disabled="isSubmitting || isRequestingEstimate || !hasItems"
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
								{{ isSubmitting ? "Placing order…" : "Place order" }}
							</Button>

							<Button
								type="button"
								variant="outline"
								class="w-full"
								:disabled="isSubmitting || isRequestingEstimate || !hasItems"
								@click="requestEstimate"
							>
								<LoaderCircle
									v-if="isRequestingEstimate"
									class="size-4 animate-spin"
								/>

								<FileText
									v-else
									class="size-4"
								/>
								{{ isRequestingEstimate ? "Requesting…" : "Request estimate instead" }}
							</Button>
						</div>

						<p class="text-muted-foreground text-xs">
							An estimate sends your cart to SupplyKey as a quote request. Your cart stays intact.
						</p>
					</CardContent>
				</Card>
			</div>
		</div>
	</div>
</template>
