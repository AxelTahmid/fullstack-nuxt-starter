<script setup lang="ts">
import { Check, Info, LoaderCircle, Minus, Plus } from "@lucide/vue"
import type { FetchError } from "ofetch"
import type { ProductListItem, ProductListResponse } from "#shared/types/product"
import { toast } from "~/components/toast"
import { useCart } from "~/composables/useCart"

definePageMeta({
	layout: "dashboard",
	middleware: ["authenticated"],
})

useHead({
	title: "Contract Pricing",
})

const cart = useCart()
await cart.refresh()

const { data, pending } = await useFetch<ProductListResponse>("/api/products")

const CONTRACT_METADATA: Array<{ terms: string, rfp: string, vendor: string, expiryDays: number }> = [
	{ terms: "Fixed 24 mo.", rfp: "RFP-2026-014", vendor: "Caterpillar Official", expiryDays: 540 },
	{ terms: "Bulk Multiplier", rfp: "RFP-2026-019", vendor: "Global Metal Logistics", expiryDays: 180 },
	{ terms: "Index-Linked Quarterly", rfp: "RFP-2026-022", vendor: "SupplyKey Direct", expiryDays: 92 },
	{ terms: "Fixed 12 mo.", rfp: "RFP-2026-031", vendor: "Hilti North America", expiryDays: 318 },
	{ terms: "Volume Discount", rfp: "RFP-2026-040", vendor: "DeWalt Industrial", expiryDays: 61 },
	{ terms: "Fixed 36 mo.", rfp: "RFP-2026-052", vendor: "Bosch Industrial", expiryDays: 870 },
]

const rows = computed(() => (data.value?.items ?? []).map((product, i) => ({
	product,
	meta: CONTRACT_METADATA[i % CONTRACT_METADATA.length],
})))

const DEFAULT_QTY = 5
const quantities = reactive<Record<string, number>>({})

function qtyFor(sourceKey: string) {
	return quantities[sourceKey] ?? DEFAULT_QTY
}

function increment(sourceKey: string) {
	quantities[sourceKey] = qtyFor(sourceKey) + 1
}

function decrement(sourceKey: string) {
	const next = qtyFor(sourceKey) - 1
	quantities[sourceKey] = next < 1 ? 1 : next
}

function setQtyFromEvent(sourceKey: string, event: Event) {
	const target = event.target as HTMLInputElement | null
	if (!target)
		return
	const parsed = Number.parseInt(target.value, 10)
	if (!Number.isFinite(parsed) || parsed < 1) {
		quantities[sourceKey] = 1
		target.value = "1"
		return
	}
	quantities[sourceKey] = parsed
}

const addingKey = ref<string | null>(null)
async function buyNow(product: ProductListItem) {
	addingKey.value = product.sourceKey
	const quantity = qtyFor(product.sourceKey)
	try {
		await cart.addItem(product.sourceKey, quantity)
		toast.success(`${quantity} unit${quantity === 1 ? "" : "s"} added to cart.`)
	}
	catch (error) {
		const fetchError = error as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to add item.")
	}
	finally {
		addingKey.value = null
	}
}
</script>

<template>
	<div class="space-y-8">
		<section class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
			<div class="space-y-2">
				<p class="text-muted-foreground text-[0.68rem] font-bold tracking-[0.24em] uppercase">
					Contract Pricing
				</p>

				<h1
					class="text-foreground text-5xl font-extrabold tracking-[-0.045em]"
					style="font-family: var(--font-display);"
				>
					Contract Pricing
				</h1>

				<p class="text-muted-foreground max-w-2xl text-sm leading-7">
					Pre-negotiated pricing from approved vendor partners. Contracts below are active for the current operator.
				</p>
			</div>

			<div class="flex gap-3">
				<div class="border-border/60 bg-card rounded-md border px-5 py-3">
					<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.18em] uppercase">
						Active Contracts
					</p>

					<p
						class="metric-value text-foreground mt-1 text-2xl font-extrabold"
						style="font-family: var(--font-display);"
					>
						142
					</p>
				</div>

				<div class="border-border/60 bg-card rounded-md border px-5 py-3">
					<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.18em] uppercase">
						Renewals (30d)
					</p>

					<p
						class="metric-value text-foreground mt-1 text-2xl font-extrabold"
						style="font-family: var(--font-display);"
					>
						08
					</p>
				</div>
			</div>
		</section>

		<section class="border-border/60 bg-card rounded-md border">
			<div
				v-if="pending"
				class="text-muted-foreground p-8 text-center text-sm"
			>
				Loading contract catalog…
			</div>

			<table
				v-else
				class="w-full text-sm"
			>
				<thead>
					<tr class="border-border/60 border-b text-left">
						<th class="text-muted-foreground px-6 py-4 text-[0.62rem] font-bold tracking-[0.14em] uppercase">
							Product
						</th>

						<th class="text-muted-foreground px-4 py-4 text-[0.62rem] font-bold tracking-[0.14em] uppercase">
							Approved Price
						</th>

						<th class="text-muted-foreground px-4 py-4 text-[0.62rem] font-bold tracking-[0.14em] uppercase">
							Vendor / RFP
						</th>

						<th class="text-muted-foreground px-4 py-4 text-[0.62rem] font-bold tracking-[0.14em] uppercase">
							Expiry
						</th>

						<th class="text-muted-foreground px-4 py-4 text-center text-[0.62rem] font-bold tracking-[0.14em] uppercase">
							Quantity
						</th>

						<th class="px-6 py-4" />
					</tr>
				</thead>

				<tbody>
					<tr
						v-for="row in rows"
						:key="row.product.sourceKey"
						class="border-border/40 border-b last:border-b-0"
					>
						<td class="px-6 py-5">
							<div class="flex items-center gap-3">
								<div class="bg-muted size-14 shrink-0 overflow-hidden rounded-md">
									<img
										v-if="row.product.imageUrl"
										:src="row.product.imageUrl"
										:alt="row.product.name"
										class="size-full object-cover"
									>
								</div>

								<div>
									<p class="text-foreground text-sm font-semibold">
										{{ row.product.name }}
									</p>

									<p class="text-muted-foreground text-[0.62rem] font-semibold tracking-wide uppercase">
										{{ row.product.sku }}
									</p>
								</div>
							</div>
						</td>

						<td class="px-4 py-5">
							<p class="text-foreground text-sm font-semibold">
								Current Sage price
							</p>

							<p class="text-muted-foreground mt-0.5 text-[0.62rem] font-semibold tracking-wide uppercase">
								Calculated in cart
							</p>
						</td>

						<td class="px-4 py-5">
							<p class="text-primary text-sm font-semibold">
								{{ row.meta?.vendor }}
							</p>

							<p class="text-muted-foreground text-[0.62rem] font-semibold tracking-wide uppercase">
								{{ row.meta?.rfp }}
							</p>
						</td>

						<td class="px-4 py-5">
							<p class="text-foreground text-sm font-semibold tabular-nums">
								{{ row.meta?.expiryDays }} days
							</p>

							<p class="text-muted-foreground text-[0.62rem] font-semibold tracking-wide uppercase">
								remaining
							</p>
						</td>

						<td class="px-4 py-5">
							<div class="flex items-center justify-center gap-2">
								<Button
									type="button"
									class="border-border/70 text-muted-foreground hover:border-primary hover:text-primary flex size-8 items-center justify-center rounded-md border transition-all disabled:opacity-50"
									:disabled="qtyFor(row.product.sourceKey) <= 1"
									@click="decrement(row.product.sourceKey)"
								>
									<Minus class="size-3.5" />
								</Button>

								<Input
									type="number"
									min="1"
									:value="qtyFor(row.product.sourceKey)"
									class="metric-value border-border/60 bg-background text-foreground focus:border-primary focus:ring-primary/30 w-14 [appearance:textfield] rounded-md border px-2 py-1 text-center text-base font-extrabold tabular-nums focus:ring-2 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
									style="font-family: var(--font-display);"
									@input="setQtyFromEvent(row.product.sourceKey, $event)"
									@blur="setQtyFromEvent(row.product.sourceKey, $event)"
								/>

								<Button
									type="button"
									class="border-border/70 text-muted-foreground hover:border-primary hover:text-primary flex size-8 items-center justify-center rounded-md border transition-all"
									@click="increment(row.product.sourceKey)"
								>
									<Plus class="size-3.5" />
								</Button>
							</div>
						</td>

						<td class="px-6 py-5">
							<div class="flex items-center justify-end gap-2">
								<Button
									type="button"
									class="border-border/70 text-muted-foreground hover:border-primary hover:text-primary flex size-9 items-center justify-center rounded-md border transition-all"
								>
									<Info class="size-4" />
								</Button>

								<Button
									type="button"
									class="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[0.62rem] font-bold tracking-[0.14em] uppercase transition-all hover:brightness-110 disabled:opacity-60"
									:disabled="addingKey === row.product.sourceKey"
									@click="buyNow(row.product)"
								>
									<LoaderCircle
										v-if="addingKey === row.product.sourceKey"
										class="size-3.5 animate-spin"
									/>

									<Check
										v-else-if="cart.summary.value.lines.some(l => l.sku === row.product.sourceKey)"
										class="size-3.5"
									/>

									<span v-else>$</span>
									Buy Now
								</Button>
							</div>
						</td>
					</tr>
				</tbody>
			</table>
		</section>

		<p class="text-muted-foreground text-center text-[0.62rem] font-semibold tracking-[0.18em] uppercase">
			Showing 1–{{ rows.length }} of {{ rows.length }} active contracts
		</p>
	</div>
</template>
