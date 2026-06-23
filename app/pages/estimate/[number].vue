<script setup lang="ts">
import type { EstimateDetail } from "#shared/types/estimate"
import type { CheckoutResponse } from "#shared/types/order"
import type { FetchError } from "ofetch"
import { AlertCircle, ArrowLeft, CalendarClock, FileText, LoaderCircle, MapPin, MessageSquarePlus, PackageCheck, User } from "@lucide/vue"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "~/components/toast"
import EstimateLineItem from "./_lib/EstimateLineItem.vue"
import EstimateStatCard from "./_lib/EstimateStatCard.vue"
import EstimateStatusBadge from "./_lib/EstimateStatusBadge.vue"
import { formatDate, formatPrice } from "./_lib/format"

definePageMeta({
	layout: "dashboard",
	middleware: ["authenticated"],
})

const route = useRoute()
const quoteNumber = computed(() => typeof route.params.number === "string" ? route.params.number : "")

const { data: estimate, pending, error } = await useFetch<EstimateDetail>(() => `/api/estimates/${quoteNumber.value}`)

useHead({
	title: computed(() => estimate.value ? `Estimate ${estimate.value.quoteNumber}` : "Estimate"),
})

const isConverting = ref(false)

const { user } = useUserSession()
const isAdmin = computed(() => (user.value as { role?: string } | null)?.role === "admin")

// Customers can open an enquiry pre-linked to this Sage quote.
const enquiryLink = computed(() => ({
	path: "/enquiries",
	query: {
		sourceType: "quote",
		sourceReference: estimate.value?.quoteNumber ?? "",
		subject: estimate.value ? `Enquiry about quote ${estimate.value.quoteNumber}` : "",
	},
}))

async function convertToOrder() {
	isConverting.value = true
	try {
		const response = await $fetch<CheckoutResponse>(`/api/estimates/${quoteNumber.value}/convert`, {
			method: "POST",
		})
		toast.success(`Order ${response.orderNumber} created from this estimate.`)
		await navigateTo(`/orders/${response.orderNumber}`)
	}
	catch (err) {
		const fetchError = err as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to convert estimate to order.")
	}
	finally {
		isConverting.value = false
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

		<div
			v-if="pending"
			class="space-y-4"
		>
			<Skeleton class="h-9 w-64" />

			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<Skeleton class="h-24" />

				<Skeleton class="h-24" />

				<Skeleton class="h-24" />

				<Skeleton class="h-24" />
			</div>

			<Skeleton class="h-64" />
		</div>

		<Alert
			v-else-if="error || !estimate"
			variant="destructive"
		>
			<AlertCircle class="size-4" />

			<AlertTitle>Could not load estimate</AlertTitle>

			<AlertDescription>
				It may have been removed or you may not have access.
			</AlertDescription>
		</Alert>

		<template v-else>
			<section class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div class="space-y-2">
					<div class="text-muted-foreground flex items-center gap-2 text-sm font-medium">
						<FileText class="size-4" />

						<span>Estimate requested</span>
					</div>

					<h1 class="text-3xl font-semibold">
						{{ estimate.quoteNumber }}
					</h1>

					<p class="text-muted-foreground max-w-xl text-sm leading-6">
						Your quote request has been sent to SupplyKey. Final pricing, availability, and logistics are confirmed before it can be converted to an order.
					</p>
				</div>

				<div class="flex flex-col items-start gap-3 sm:items-end">
					<EstimateStatusBadge :status="estimate.status" />

					<Button
						v-if="estimate.status === 'submitted'"
						type="button"
						:disabled="isConverting"
						@click="convertToOrder"
					>
						<LoaderCircle
							v-if="isConverting"
							class="size-4 animate-spin"
						/>

						<PackageCheck
							v-else
							class="size-4"
						/>
						{{ isConverting ? "Converting…" : "Convert to order" }}
					</Button>

					<Button
						v-else-if="estimate.status === 'converted' && estimate.convertedOrderNumber"
						as-child
						variant="outline"
					>
						<NuxtLink :to="`/orders/${estimate.convertedOrderNumber}`">
							<PackageCheck class="size-4" />
							View order {{ estimate.convertedOrderNumber }}
						</NuxtLink>
					</Button>

					<Button
						v-if="!isAdmin"
						as-child
						variant="outline"
						size="sm"
					>
						<NuxtLink :to="enquiryLink">
							<MessageSquarePlus class="size-4" />
							Raise enquiry
						</NuxtLink>
					</Button>
				</div>
			</section>

			<section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<EstimateStatCard
					:icon="User"
					label="Customer"
					:value="estimate.customerName"
					:sub="estimate.customerNumber && estimate.customerNumber !== estimate.customerName ? estimate.customerNumber : undefined"
				/>

				<EstimateStatCard
					:icon="MapPin"
					label="Delivery site"
					:value="estimate.deliverySite"
				/>

				<EstimateStatCard
					:icon="CalendarClock"
					label="Valid until"
					:value="estimate.expiresAt ? formatDate(estimate.expiresAt) : 'To be confirmed'"
				/>

				<EstimateStatCard
					:icon="FileText"
					label="Requested"
					:value="formatDate(estimate.createdAt)"
				/>
			</section>

			<section class="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
				<Card>
					<CardHeader>
						<CardTitle>Line items</CardTitle>
					</CardHeader>

					<CardContent class="space-y-3">
						<template v-if="estimate.lines.length">
							<EstimateLineItem
								v-for="line in estimate.lines"
								:key="line.id"
								:name="line.name"
								:sku="line.sku"
								:quantity="line.quantity"
								:unit-price-cents="line.unitPriceCents"
								:line-total-cents="line.lineTotalCents"
							/>
						</template>

						<p
							v-else
							class="bg-muted text-muted-foreground rounded-md p-6 text-center text-sm"
						>
							Line items will appear once SupplyKey confirms the quote.
						</p>
					</CardContent>
				</Card>

				<aside class="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle class="text-base">
								Indicative totals
							</CardTitle>
						</CardHeader>

						<CardContent class="space-y-4">
							<dl class="space-y-2 text-sm">
								<div class="flex items-center justify-between">
									<dt class="text-muted-foreground">
										Subtotal
									</dt>

									<dd class="font-medium tabular-nums">
										{{ formatPrice(estimate.subtotalCents) }}
									</dd>
								</div>

								<div class="flex items-center justify-between">
									<dt class="text-muted-foreground">
										Tax
									</dt>

									<dd class="font-medium tabular-nums">
										{{ formatPrice(estimate.taxCents) }}
									</dd>
								</div>
							</dl>

							<Separator />

							<div class="flex items-center justify-between">
								<span class="text-sm font-medium">Estimated total</span>

								<span class="text-lg font-semibold tabular-nums">
									{{ formatPrice(estimate.totalCents) }}
								</span>
							</div>

							<p class="text-muted-foreground text-xs">
								Final pricing is confirmed by SupplyKey on the quote.
							</p>
						</CardContent>
					</Card>

					<Card v-if="estimate.comment">
						<CardHeader>
							<CardTitle class="text-base">
								Request notes
							</CardTitle>
						</CardHeader>

						<CardContent>
							<p class="text-sm whitespace-pre-line">
								{{ estimate.comment }}
							</p>
						</CardContent>
					</Card>
				</aside>
			</section>
		</template>
	</div>
</template>
