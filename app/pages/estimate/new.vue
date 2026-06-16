<script setup lang="ts">
import type { EstimateResponse } from "#shared/types/estimate"
import type { FetchError } from "ofetch"
import { ArrowLeft, FileText, LoaderCircle } from "@lucide/vue"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "~/components/toast"
import { useCart } from "~/composables/useCart"
import EstimateLineItem from "./_lib/EstimateLineItem.vue"
import { formatPrice } from "./_lib/format"

definePageMeta({
	layout: "dashboard",
	middleware: ["authenticated"],
})

useHead({
	title: "Request estimate",
})

const cart = useCart()
await cart.refresh()

const deliverySite = ref("")
const deliveryContact = ref("")
const requestedShipDate = ref("")
const projectReference = ref("")
const budgetRange = ref("")
const notes = ref("")
const isSubmitting = ref(false)

const hasItems = computed(() => cart.summary.value.lines.length > 0)

async function requestEstimate() {
	if (!hasItems.value) {
		toast.error("Add at least one item before requesting an estimate.")
		return
	}
	if (!deliverySite.value.trim()) {
		toast.error("Delivery site is required.")
		return
	}

	isSubmitting.value = true
	try {
		// Items are omitted so the server builds the quote from the current cart.
		const response = await $fetch<EstimateResponse>("/api/estimates", {
			method: "POST",
			body: {
				deliverySite: deliverySite.value.trim(),
				deliveryContact: deliveryContact.value.trim() || undefined,
				requestedShipDate: requestedShipDate.value || undefined,
				projectReference: projectReference.value.trim() || undefined,
				budgetRange: budgetRange.value.trim() || undefined,
				notes: notes.value.trim() || undefined,
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
		isSubmitting.value = false
	}
}
</script>

<template>
	<div class="space-y-6">
		<Button
			as-child
			variant="ghost"
			size="sm"
			class="-ml-2 w-fit"
		>
			<NuxtLink to="/estimate">
				<ArrowLeft class="size-4" />
				Back to estimates
			</NuxtLink>
		</Button>

		<section class="space-y-2">
			<div class="text-muted-foreground flex items-center gap-2 text-sm font-medium">
				<FileText class="size-4" />

				<span>Quotation workflow</span>
			</div>

			<h1 class="text-3xl font-semibold">
				Request estimate
			</h1>

			<p class="text-muted-foreground max-w-2xl text-sm leading-6">
				Send your current cart to SupplyKey as a quote request. Pricing, availability, and logistics are confirmed on the returned quote.
			</p>
		</section>

		<section class="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
			<div class="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Estimate items</CardTitle>

						<CardDescription>
							{{ cart.summary.value.itemCount }} unit{{ cart.summary.value.itemCount === 1 ? "" : "s" }} from your cart
						</CardDescription>
					</CardHeader>

					<CardContent class="space-y-3">
						<template v-if="hasItems">
							<EstimateLineItem
								v-for="line in cart.summary.value.lines"
								:key="line.id"
								:name="line.name"
								:sku="line.sku"
								:meta="line.manufacturer"
								:quantity="line.quantity"
							/>
						</template>

						<div
							v-else
							class="bg-muted rounded-md p-6 text-center"
						>
							<p class="text-muted-foreground text-sm">
								No items selected. Add products to your cart, then request an estimate.
							</p>

							<Button
								as-child
								class="mt-4"
							>
								<NuxtLink to="/shop">
									Browse catalog
								</NuxtLink>
							</Button>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Project details</CardTitle>
					</CardHeader>

					<CardContent class="space-y-4">
						<div class="grid gap-4 sm:grid-cols-2">
							<div class="space-y-2">
								<Label for="deliverySite">Delivery site</Label>

								<Input
									id="deliverySite"
									v-model="deliverySite"
									placeholder="Receiving address, yard, or site"
								/>
							</div>

							<div class="space-y-2">
								<Label for="deliveryContact">Delivery contact</Label>

								<Input
									id="deliveryContact"
									v-model="deliveryContact"
									placeholder="Name, phone, or receiving desk"
								/>
							</div>
						</div>

						<div class="grid gap-4 sm:grid-cols-2">
							<div class="space-y-2">
								<Label for="neededBy">Needed by</Label>

								<Input
									id="neededBy"
									v-model="requestedShipDate"
									type="date"
								/>
							</div>

							<div class="space-y-2">
								<Label for="projectReference">Project reference</Label>

								<Input
									id="projectReference"
									v-model="projectReference"
									placeholder="e.g. NB-2026-STRUCTURAL"
								/>
							</div>
						</div>

						<div class="space-y-2">
							<Label for="budgetRange">Budget range (optional)</Label>

							<Input
								id="budgetRange"
								v-model="budgetRange"
								placeholder="e.g. $750k – $950k"
								class="sm:max-w-xs"
							/>
						</div>

						<div class="space-y-2">
							<Label for="notes">Notes</Label>

							<Textarea
								id="notes"
								v-model="notes"
								placeholder="Specifications, compliance requirements, substitutions, or site constraints"
							/>
						</div>
					</CardContent>
				</Card>
			</div>

			<aside class="lg:sticky lg:top-6 lg:self-start">
				<Card>
					<CardHeader>
						<CardTitle class="text-base">
							Estimate request
						</CardTitle>
					</CardHeader>

					<CardContent class="space-y-4">
						<dl class="space-y-2 text-sm">
							<div class="flex items-center justify-between">
								<dt class="text-muted-foreground">
									Items
								</dt>

								<dd class="font-medium tabular-nums">
									{{ cart.summary.value.itemCount }}
								</dd>
							</div>

							<div class="flex items-center justify-between">
								<dt class="text-muted-foreground">
									Indicative subtotal
								</dt>

								<dd class="font-medium tabular-nums">
									{{ formatPrice(cart.summary.value.subtotalCents) }}
								</dd>
							</div>
						</dl>

						<Separator />

						<p class="text-muted-foreground text-xs">
							Final pricing is confirmed by SupplyKey on the returned quote. Your cart stays intact.
						</p>

						<Button
							type="button"
							class="w-full"
							:disabled="isSubmitting || !hasItems"
							@click="requestEstimate"
						>
							<LoaderCircle
								v-if="isSubmitting"
								class="size-4 animate-spin"
							/>

							<FileText
								v-else
								class="size-4"
							/>
							{{ isSubmitting ? "Requesting…" : "Request estimate" }}
						</Button>
					</CardContent>
				</Card>
			</aside>
		</section>
	</div>
</template>
