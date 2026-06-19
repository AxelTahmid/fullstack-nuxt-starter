<script setup lang="ts">
import { ArrowUpRight, LoaderCircle, Plus, Search, X } from "@lucide/vue"
import type { FetchError } from "ofetch"
import type { EnquirySummary } from "#shared/types/enquiry"
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
const filtered = computed(() => {
	const rows = data.value ?? []
	if (!searchQuery.value.trim())
		return rows
	const q = searchQuery.value.trim().toLowerCase()
	return rows.filter(r =>
		r.enquiryNumber.toLowerCase().includes(q)
		|| r.subject.toLowerCase().includes(q)
		|| r.supplierName.toLowerCase().includes(q),
	)
})

const priorityStyles: Record<string, string> = {
	urgent: "bg-destructive text-destructive-foreground",
	high: "bg-destructive/15 text-destructive",
	medium: "bg-primary/10 text-primary",
	low: "bg-muted text-muted-foreground",
}

const statusStyles: Record<string, string> = {
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

function openModal() {
	form.subject = ""
	form.supplierName = ""
	form.productSku = ""
	form.initialMessage = ""
	isModalOpen.value = true
}

function closeModal() {
	isModalOpen.value = false
}

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
				initialMessage: form.initialMessage.trim(),
			},
		})
		toast.success(`Enquiry ${response.enquiryNumber} dispatched.`)
		closeModal()
		await refresh()
		await navigateTo(`/enquiries/${response.enquiryNumber}`)
	}
	catch (err) {
		const fetchError = err as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to create enquiry.")
	}
	finally {
		isSubmitting.value = false
	}
}
</script>

<template>
	<div class="space-y-8">
		<section class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
			<div class="space-y-2">
				<p class="text-muted-foreground text-[0.68rem] font-bold tracking-[0.24em] uppercase">
					Supplier Correspondence
				</p>

				<h1
					class="text-foreground text-5xl font-extrabold tracking-[-0.045em]"
					style="font-family: var(--font-display);"
				>
					Enquiries &amp; Follow-ups
				</h1>

				<p class="text-muted-foreground max-w-2xl text-sm leading-7">
					Ticket tracker for all active supplier communications. Priority-weighted and bound to the active operator.
				</p>
			</div>

			<div class="flex items-center gap-3">
				<div class="relative">
					<Search class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />

					<Input
						v-model="searchQuery"
						type="text"
						placeholder="Search enquiries…"
						class="border-border/60 bg-card text-foreground placeholder:text-muted-foreground/60 focus:ring-primary/40 w-64 rounded-md border py-2.5 pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
					/>
				</div>

				<Button
					v-if="!isAdmin"
					type="button"
					class="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-[0.68rem] font-bold tracking-[0.14em] uppercase transition-all hover:brightness-110"
					style="font-family: var(--font-display);"
					@click="openModal"
				>
					<Plus class="size-4" />
					New Enquiry
				</Button>
			</div>
		</section>

		<section>
			<div
				v-if="pending"
				class="space-y-3"
			>
				<div
					v-for="i in 3"
					:key="i"
					class="bg-muted h-28 animate-pulse rounded-md"
				/>
			</div>

			<div
				v-else-if="!filtered.length"
				class="border-border/60 bg-card rounded-md border p-12 text-center"
			>
				<p class="text-muted-foreground text-sm">
					{{ isAdmin ? "No enquiries received yet." : "No enquiries match this search." }}
				</p>

				<Button
					v-if="!isAdmin"
					type="button"
					class="bg-primary text-primary-foreground mt-4 inline-flex items-center gap-2 rounded-md px-4 py-2 text-[0.62rem] font-bold tracking-[0.14em] uppercase transition-all hover:brightness-110"
					@click="openModal"
				>
					<Plus class="size-3.5" />
					New Enquiry
				</Button>
			</div>

			<ul
				v-else
				class="space-y-3"
			>
				<li
					v-for="enquiry in filtered"
					:key="enquiry.id"
				>
					<NuxtLink
						:to="`/enquiries/${enquiry.enquiryNumber}`"
						class="group border-border/60 bg-card hover:border-primary/40 flex items-start gap-5 rounded-md border p-6 transition-all"
					>
						<div class="min-w-0 flex-1 space-y-2">
							<div class="flex items-center gap-2">
								<span
									v-if="isAdmin"
									class="rounded-sm px-2 py-0.5 text-[0.58rem] font-bold tracking-[0.14em] uppercase"
									:class="priorityStyles[enquiry.priority]"
								>
									{{ enquiry.priority }}
								</span>

								<span
									class="rounded-sm px-2 py-0.5 text-[0.58rem] font-bold tracking-[0.14em] uppercase"
									:class="statusStyles[enquiry.status]"
								>
									{{ enquiry.status }}
								</span>

								<span class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.16em] uppercase">
									{{ enquiry.enquiryNumber }}
								</span>
							</div>

							<h3
								class="text-foreground text-lg font-extrabold tracking-[-0.015em]"
								style="font-family: var(--font-display);"
							>
								{{ enquiry.subject }}
							</h3>

							<p class="text-primary text-xs font-semibold">
								{{ enquiry.supplierName }}
							</p>

							<p class="text-muted-foreground line-clamp-2 text-sm">
								{{ enquiry.lastMessagePreview }}
							</p>
						</div>

						<div class="flex flex-col items-end gap-3">
							<span
								v-if="(unreadMap[enquiry.enquiryNumber] ?? enquiry.unreadCount) > 0"
								class="bg-primary text-primary-foreground inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.6rem] font-bold"
							>
								{{ unreadMap[enquiry.enquiryNumber] ?? enquiry.unreadCount }}
							</span>

							<span class="text-muted-foreground text-[0.62rem] font-semibold tracking-wide whitespace-nowrap">
								{{ formatDate(enquiry.updatedAt) }}
							</span>

							<div class="border-border/70 text-muted-foreground group-hover:border-primary group-hover:text-primary flex size-9 items-center justify-center rounded-md border transition-all">
								<ArrowUpRight class="size-4" />
							</div>
						</div>
					</NuxtLink>
				</li>
			</ul>
		</section>

		<Teleport to="body">
			<div
				v-if="isModalOpen"
				class="fixed inset-0 z-50 flex items-center justify-center p-4"
			>
				<div
					class="bg-foreground/40 absolute inset-0 backdrop-blur-sm"
					@click="closeModal"
				/>

				<div class="border-border/60 bg-card relative w-full max-w-xl rounded-md border shadow-2xl">
					<header class="border-border/40 flex items-start justify-between border-b p-6">
						<div>
							<p
								class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase"
								style="font-family: var(--font-display);"
							>
								New Enquiry
							</p>

							<h2
								class="text-foreground mt-1 text-2xl font-extrabold tracking-[-0.02em]"
								style="font-family: var(--font-display);"
							>
								Dispatch to supplier network
							</h2>
						</div>

						<Button
							type="button"
							class="text-muted-foreground hover:bg-muted hover:text-foreground flex size-9 items-center justify-center rounded-md transition-all"
							@click="closeModal"
						>
							<X class="size-4" />
						</Button>
					</header>

					<form
						class="space-y-5 p-6"
						@submit.prevent="submitEnquiry"
					>
						<div>
							<Label class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.18em] uppercase">
								Subject
							</Label>

							<Input
								v-model="form.subject"
								type="text"
								placeholder="e.g. Hydraulic valve specs — Pit C"
								class="bg-muted text-foreground placeholder:text-muted-foreground/60 focus:ring-primary/40 mt-2 w-full rounded-md px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
								:disabled="isSubmitting"
							/>
						</div>

						<div class="grid gap-5 sm:grid-cols-2">
							<div>
								<Label class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.18em] uppercase">
									Supplier
								</Label>

								<Input
									v-model="form.supplierName"
									type="text"
									placeholder="Supplier name"
									list="supplier-options"
									class="bg-muted text-foreground placeholder:text-muted-foreground/60 focus:ring-primary/40 mt-2 w-full rounded-md px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
									:disabled="isSubmitting"
								/>

								<datalist id="supplier-options">
									<option
										v-for="s in supplierSuggestions"
										:key="s"
										:value="s"
									/>
								</datalist>
							</div>

							<div>
								<Label class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.18em] uppercase">
									Product SKU (optional)
								</Label>

								<Input
									v-model="form.productSku"
									type="text"
									placeholder="SKI-VLV-XP900"
									class="bg-muted text-foreground placeholder:text-muted-foreground/60 focus:ring-primary/40 mt-2 w-full rounded-md px-3 py-2.5 font-mono text-sm focus:ring-2 focus:outline-none"
									:disabled="isSubmitting"
								/>
							</div>
						</div>

						<div>
							<Label class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.18em] uppercase">
								Initial Message
							</Label>

							<Textarea
								v-model="form.initialMessage"
								rows="4"
								placeholder="Describe your requirement, quantity, and timeline…"
								class="bg-muted text-foreground placeholder:text-muted-foreground/60 focus:ring-primary/40 mt-2 w-full resize-none rounded-md px-3 py-2.5 text-sm leading-6 focus:ring-2 focus:outline-none"
								:disabled="isSubmitting"
							/>
						</div>

						<div class="flex items-center justify-end gap-3 pt-2">
							<Button
								type="button"
								class="border-border/70 text-muted-foreground hover:border-foreground hover:text-foreground rounded-md border px-4 py-2 text-[0.62rem] font-bold tracking-[0.14em] uppercase transition-all"
								:disabled="isSubmitting"
								@click="closeModal"
							>
								Cancel
							</Button>

							<Button
								type="submit"
								class="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-5 py-2 text-[0.62rem] font-bold tracking-[0.14em] uppercase transition-all hover:brightness-110 disabled:opacity-60"
								:disabled="isSubmitting"
							>
								<LoaderCircle
									v-if="isSubmitting"
									class="size-3.5 animate-spin"
								/>
								{{ isSubmitting ? "Dispatching…" : "Dispatch Enquiry" }}
							</Button>
						</div>
					</form>
				</div>
			</div>
		</Teleport>
	</div>
</template>
