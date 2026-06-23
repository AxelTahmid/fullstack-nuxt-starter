<script setup lang="ts">
import type { EnquirySourceType, EnquirySummary } from "#shared/types/enquiry"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ArrowUpRight, LoaderCircle, MessageSquarePlus, Plus, Search } from "@lucide/vue"
import type { FetchError } from "ofetch"
import AppPagination from "~/components/AppPagination.vue"
import { toast } from "~/components/toast"
import { useEnquiryStream } from "~/composables/useEnquiryStream"

definePageMeta({
	layout: "dashboard",
	middleware: ["authenticated"],
})

useHead({
	title: "Enquiries",
})

const { data, pending, refresh } = await useFetch<EnquirySummary[]>("/api/enquiries")

const route = useRoute()
const { user } = useUserSession()
// Admins triage and reply only; customers are the ones who raise enquiries.
const isAdmin = computed(() => user.value?.role === "admin")

const { unreadMap, setUnreadFromSummaries, onEnquiryEvent } = useEnquiryStream()

// Keep the shared unread map in sync with the list whenever it (re)loads.
watch(data, (rows) => {
	if (rows) {
		setUnreadFromSummaries(rows)
	}
}, { immediate: true })

// Any inbound message or status change re-orders/refreshes the list.
onEnquiryEvent((realtimeEvent) => {
	if (realtimeEvent.type !== "read") {
		refresh()
	}
})

const searchQuery = ref("")
const statusFilter = ref<"all" | "open" | "resolved">("all")

const rows = computed(() => data.value ?? [])
const openCount = computed(() => rows.value.filter(r => r.status !== "resolved").length)
const resolvedCount = computed(() => rows.value.filter(r => r.status === "resolved").length)

const filtered = computed(() => {
	let result = rows.value
	if (statusFilter.value === "open") {
		result = result.filter(r => r.status !== "resolved")
	}
	else if (statusFilter.value === "resolved") {
		result = result.filter(r => r.status === "resolved")
	}
	const q = searchQuery.value.trim().toLowerCase()
	if (q) {
		result = result.filter(r =>
			r.enquiryNumber.toLowerCase().includes(q)
			|| r.subject.toLowerCase().includes(q)
			|| r.supplierName.toLowerCase().includes(q),
		)
	}
	return result
})

const PAGE_SIZE = 8
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paged = computed(() => {
	const start = (Math.min(page.value, totalPages.value) - 1) * PAGE_SIZE
	return filtered.value.slice(start, start + PAGE_SIZE)
})
// Back to page 1 whenever the filter/search narrows the list, and keep page in range.
watch([searchQuery, statusFilter], () => (page.value = 1))
watch(totalPages, (tp) => {
	if (page.value > tp) {
		page.value = tp
	}
})

const priorityVariants: Record<string, string> = {
	urgent: "bg-destructive text-destructive-foreground",
	high: "bg-destructive/15 text-destructive",
	medium: "bg-primary/10 text-primary",
	low: "bg-muted text-muted-foreground",
}

const statusVariants: Record<string, string> = {
	sent: "bg-muted text-muted-foreground",
	received: "bg-chart-4/20 text-primary",
	reviewing: "bg-primary/10 text-primary",
	responded: "bg-success/10 text-success",
	resolved: "bg-muted text-muted-foreground",
}

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const isModalOpen = ref(false)
const form = reactive({
	subject: "",
	supplierName: "",
	productSku: "",
	sourceType: "general" as EnquirySourceType,
	sourceReference: "",
	initialMessage: "",
})
const isSubmitting = ref(false)

const supplierSuggestions = [
	"SupplyKey Direct",
	"Global Metal Logistics Corp",
	"Caterpillar Official",
	"Hilti North America",
	"Bosch Industrial",
	"Cummins Power Systems",
]

// When raised from an order/estimate/product the linkage is fixed context and
// must not be edited; a manual "New Enquiry" keeps those fields editable.
const linkLocked = ref(false)
const linkContextLabel = computed(() => {
	if (form.sourceType === "order") {
		return "order"
	}
	if (form.sourceType === "quote") {
		return "estimate"
	}
	if (form.productSku) {
		return "product"
	}
	return "page"
})

function openModal(prefill?: Partial<typeof form>, locked = false) {
	form.subject = prefill?.subject ?? ""
	form.supplierName = prefill?.supplierName ?? ""
	form.productSku = prefill?.productSku ?? ""
	form.sourceType = prefill?.sourceType ?? "general"
	form.sourceReference = prefill?.sourceReference ?? ""
	form.initialMessage = ""
	linkLocked.value = locked
	isModalOpen.value = true
}

// Source pages (order/quote/product detail) deep-link here with prefill params.
onMounted(() => {
	const q = route.query
	if (isAdmin.value || !(q.sourceReference || q.productSku || q.subject)) {
		return
	}
	const str = (value: unknown) => (typeof value === "string" ? value : "")
	const rawType = str(q.sourceType)
	const sourceType: EnquirySourceType = rawType === "order" ? "order" : rawType === "quote" ? "quote" : "general"
	openModal({
		subject: str(q.subject),
		supplierName: str(q.supplierName),
		productSku: str(q.productSku),
		sourceType,
		sourceReference: str(q.sourceReference),
	}, true)
	// Drop the params so a refresh does not reopen the modal.
	return navigateTo({ query: {} }, { replace: true })
})

async function submitEnquiry() {
	if (!form.subject.trim() || !form.supplierName.trim() || !form.initialMessage.trim()) {
		toast.error("Subject, supplier, and message are required.")
		return
	}
	isSubmitting.value = true
	try {
		const response = await $fetch<{ enquiryNumber: string }>("/api/enquiries", {
			method: "POST",
			body: {
				subject: form.subject.trim(),
				supplierName: form.supplierName.trim(),
				productSku: form.productSku.trim() || undefined,
				sourceType: form.sourceType === "general" ? undefined : form.sourceType,
				sourceReference: form.sourceReference.trim() || undefined,
				initialMessage: form.initialMessage.trim(),
			},
		})
		toast.success(`Enquiry ${response.enquiryNumber} dispatched.`)
		isModalOpen.value = false
		await refresh()
		await navigateTo(`/enquiries/${response.enquiryNumber}`)
	}
	catch (err) {
		const fetchError = err as FetchError<{ message?: string, data?: { enquiryNumber?: string } }>
		// A 409 means an open enquiry already exists for this item — open it instead.
		const existing = fetchError.data?.data?.enquiryNumber
		if (fetchError.statusCode === 409 && existing) {
			// Don't lose what they typed — add it to the existing open thread.
			const messageText = form.initialMessage.trim()
			let appended = false
			if (messageText) {
				try {
					await $fetch(`/api/enquiries/${existing}/messages`, {
						method: "POST",
						body: { body: messageText },
					})
					appended = true
				}
				catch {
					// Non-fatal: still open the existing thread.
				}
			}
			toast.info(appended
				? "You already have an open enquiry for this — added your message to it."
				: "You already have an open enquiry for this. Opening it.")
			isModalOpen.value = false
			await navigateTo(`/enquiries/${existing}`)
			return
		}
		toast.error(fetchError.data?.message || "Unable to create enquiry.")
	}
	finally {
		isSubmitting.value = false
	}
}
</script>

<template>
	<div class="space-y-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div class="space-y-1">
				<h1 class="text-2xl font-semibold tracking-tight">
					Enquiries
				</h1>

				<p class="text-muted-foreground text-sm">
					{{ isAdmin
						? "Triage and respond to customer enquiries about orders, estimates, and products."
						: "Raise and track enquiries with the SupplyKey team." }}
				</p>
			</div>

			<Button
				v-if="!isAdmin"
				type="button"
				@click="openModal()"
			>
				<Plus class="size-4" />
				New enquiry
			</Button>
		</div>

		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<Tabs v-model="statusFilter">
				<TabsList>
					<TabsTrigger value="all">
						All
						<Badge
							variant="secondary"
							class="ml-1.5"
						>
							{{ rows.length }}
						</Badge>
					</TabsTrigger>

					<TabsTrigger value="open">
						Open
						<Badge
							variant="secondary"
							class="ml-1.5"
						>
							{{ openCount }}
						</Badge>
					</TabsTrigger>

					<TabsTrigger value="resolved">
						Resolved
						<Badge
							variant="secondary"
							class="ml-1.5"
						>
							{{ resolvedCount }}
						</Badge>
					</TabsTrigger>
				</TabsList>
			</Tabs>

			<div class="relative sm:w-64">
				<Search class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />

				<Input
					v-model="searchQuery"
					type="text"
					placeholder="Search enquiries…"
					class="pl-9"
				/>
			</div>
		</div>

		<div class="space-y-4">
			<div
				v-if="pending"
				class="space-y-3"
			>
				<div
					v-for="i in 3"
					:key="i"
					class="bg-muted h-24 animate-pulse rounded-lg"
				/>
			</div>

			<div
				v-else-if="!filtered.length"
				class="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center"
			>
				<div class="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
					<MessageSquarePlus class="size-5" />
				</div>

				<p class="text-muted-foreground text-sm">
					{{ isAdmin ? "No enquiries to show." : "No enquiries match this view." }}
				</p>

				<Button
					v-if="!isAdmin"
					type="button"
					variant="outline"
					size="sm"
					@click="openModal()"
				>
					<Plus class="size-4" />
					New enquiry
				</Button>
			</div>

			<ul
				v-else
				class="space-y-2"
			>
				<li
					v-for="enquiry in paged"
					:key="enquiry.id"
				>
					<NuxtLink
						:to="`/enquiries/${enquiry.enquiryNumber}`"
						class="group bg-card hover:border-primary/50 flex items-start gap-4 rounded-lg border p-4 transition-colors"
					>
						<div class="min-w-0 flex-1 space-y-1.5">
							<div class="flex flex-wrap items-center gap-2">
								<span class="text-muted-foreground font-mono text-xs">
									{{ enquiry.enquiryNumber }}
								</span>

								<Badge
									v-if="isAdmin"
									class="capitalize"
									:class="priorityVariants[enquiry.priority]"
								>
									{{ enquiry.priority }}
								</Badge>

								<Badge
									class="capitalize"
									:class="statusVariants[enquiry.status]"
								>
									{{ enquiry.status }}
								</Badge>
							</div>

							<h3 class="truncate font-semibold">
								{{ enquiry.subject }}
							</h3>

							<p class="text-muted-foreground truncate text-sm">
								<span class="text-foreground/80 font-medium">{{ enquiry.supplierName }}</span>
								· {{ enquiry.lastMessagePreview }}
							</p>
						</div>

						<div class="flex shrink-0 flex-col items-end gap-2">
							<Badge
								v-if="(unreadMap[enquiry.enquiryNumber] ?? enquiry.unreadCount) > 0"
								class="rounded-full"
							>
								{{ unreadMap[enquiry.enquiryNumber] ?? enquiry.unreadCount }}
							</Badge>

							<span class="text-muted-foreground text-xs whitespace-nowrap">
								{{ formatDate(enquiry.updatedAt) }}
							</span>

							<ArrowUpRight class="text-muted-foreground group-hover:text-primary size-4 transition-colors" />
						</div>
					</NuxtLink>
				</li>
			</ul>

			<AppPagination
				v-if="!pending && filtered.length"
				v-model:page="page"
				:total-pages="totalPages"
				:total-items="filtered.length"
				:page-size="PAGE_SIZE"
			/>
		</div>

		<!-- New enquiry -->
		<Dialog v-model:open="isModalOpen">
			<DialogContent class="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>New enquiry</DialogTitle>

					<DialogDescription>
						Send a question to the SupplyKey team. We'll reply in this thread.
					</DialogDescription>
				</DialogHeader>

				<form
					class="space-y-4"
					@submit.prevent="submitEnquiry"
				>
					<Field>
						<FieldLabel for="enquiry-subject">
							Subject
						</FieldLabel>

						<Input
							id="enquiry-subject"
							v-model="form.subject"
							type="text"
							placeholder="e.g. Hydraulic valve specs — Pit C"
							:disabled="isSubmitting"
						/>
					</Field>

					<FieldGroup class="grid gap-4 sm:grid-cols-2">
						<Field>
							<FieldLabel for="enquiry-supplier">
								Supplier
							</FieldLabel>

							<Input
								id="enquiry-supplier"
								v-model="form.supplierName"
								type="text"
								placeholder="Supplier name"
								list="supplier-options"
								:disabled="isSubmitting"
							/>

							<datalist id="supplier-options">
								<option
									v-for="s in supplierSuggestions"
									:key="s"
									:value="s"
								/>
							</datalist>
						</Field>

						<Field>
							<FieldLabel for="enquiry-sku">
								Product SKU (optional)
							</FieldLabel>

							<Input
								id="enquiry-sku"
								v-model="form.productSku"
								type="text"
								placeholder="SKI-VLV-XP900"
								class="font-mono"
								:disabled="isSubmitting || linkLocked"
							/>
						</Field>
					</FieldGroup>

					<FieldGroup
						v-if="!linkLocked || form.sourceType !== 'general'"
						class="grid gap-4 sm:grid-cols-2"
					>
						<Field>
							<FieldLabel for="enquiry-doc-type">
								Linked document
							</FieldLabel>

							<NativeSelect
								id="enquiry-doc-type"
								v-model="form.sourceType"
								:disabled="isSubmitting || linkLocked"
							>
								<option value="general">
									None
								</option>

								<option value="order">
									Order
								</option>

								<option value="quote">
									Quote
								</option>
							</NativeSelect>
						</Field>

						<Field v-if="form.sourceType !== 'general'">
							<FieldLabel for="enquiry-doc-ref">
								Document number
							</FieldLabel>

							<Input
								id="enquiry-doc-ref"
								v-model="form.sourceReference"
								type="text"
								placeholder="e.g. ORD-001234"
								class="font-mono"
								:disabled="isSubmitting || linkLocked"
							/>
						</Field>
					</FieldGroup>

					<p
						v-if="linkLocked"
						class="text-muted-foreground text-xs"
					>
						Linked from the {{ linkContextLabel }} you came from — these references can't be changed here.
					</p>

					<Field>
						<FieldLabel for="enquiry-message">
							Message
						</FieldLabel>

						<Textarea
							id="enquiry-message"
							v-model="form.initialMessage"
							rows="4"
							placeholder="Describe your requirement, quantity, and timeline…"
							:disabled="isSubmitting"
						/>
					</Field>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							:disabled="isSubmitting"
							@click="isModalOpen = false"
						>
							Cancel
						</Button>

						<Button
							type="submit"
							:disabled="isSubmitting"
						>
							<LoaderCircle
								v-if="isSubmitting"
								class="size-4 animate-spin"
							/>
							{{ isSubmitting ? "Sending…" : "Send enquiry" }}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	</div>
</template>
