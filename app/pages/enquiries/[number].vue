<script setup lang="ts">
import { ArrowLeft, Bold, Check, Factory, FileText, Italic, LoaderCircle, Paperclip, Send, Smile, Users } from "@lucide/vue"
import type { FetchError } from "ofetch"
import type { EnquiryMessage, EnquiryPriority, EnquiryReadResponse, EnquiryStatus, EnquirySummary, EnquiryThread, MessageSenderSide } from "#shared/types/enquiry"
import { toast } from "~/components/toast"
import { useEnquiryStream } from "~/composables/useEnquiryStream"

definePageMeta({
	layout: "dashboard",
	middleware: ["authenticated"],
	fullHeight: true,
})

const route = useRoute()
const number = computed(() => typeof route.params.number === "string" ? route.params.number : "")

const { data: thread, pending, error, refresh: refreshThread } = await useFetch<EnquiryThread>(
	() => `/api/enquiries/${number.value}`,
	{ watch: [number] },
)

const { data: enquiries, refresh: refreshList } = await useFetch<EnquirySummary[]>("/api/enquiries")

const { unreadMap, clearUnread, setActiveEnquiry, onEnquiryEvent } = useEnquiryStream()

useHead({
	title: computed(() => thread.value ? `${thread.value.enquiryNumber} · ${thread.value.subject}` : "Enquiry"),
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

const priorityOptions: EnquiryPriority[] = ["low", "medium", "high", "urgent"]
const statusOptions: EnquiryStatus[] = ["sent", "received", "reviewing", "responded", "resolved"]

function formatDateTime(iso: string) {
	const date = new Date(iso)
	return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

/** A message belongs to the viewer's own side (rendered on the right). */
function isMine(side: MessageSenderSide) {
	return side === (thread.value?.viewerSide ?? "customer")
}

// Read receipt: has the other party seen my latest message?
const otherSideLastRead = computed(() => {
	if (!thread.value) {
		return null
	}
	return thread.value.viewerSide === "customer"
		? thread.value.supportLastReadMessageId
		: thread.value.customerLastReadMessageId
})

const lastOwnMessageId = computed(() => {
	if (!thread.value) {
		return null
	}
	const own = thread.value.messages.filter(message => isMine(message.senderSide))
	return own.length ? own[own.length - 1]!.id : null
})

const ownLatestSeen = computed(() =>
	otherSideLastRead.value !== null
	&& lastOwnMessageId.value !== null
	&& otherSideLastRead.value >= lastOwnMessageId.value,
)

const lastActivity = computed(() => {
	const messages = thread.value?.messages
	return messages && messages.length ? messages[messages.length - 1]!.createdAt : null
})

const replyBody = ref("")
const sending = ref(false)
const editingField = ref<"priority" | "status" | null>(null)
const messagesContainer = useTemplateRef<HTMLElement>("messagesContainer")

function scrollToBottom() {
	nextTick(() => {
		const el = messagesContainer.value
		if (el) {
			el.scrollTop = el.scrollHeight
		}
	})
}

async function markThreadRead() {
	if (!number.value) {
		return
	}
	try {
		await $fetch<EnquiryReadResponse>(`/api/enquiries/${number.value}/read`, { method: "POST" })
		clearUnread(number.value)
	}
	catch {
		// Non-fatal: the badge will reconcile on the next list refresh.
	}
}

async function sendMessage() {
	if (!replyBody.value.trim()) {
		toast.error("Message body cannot be empty.")
		return
	}
	sending.value = true
	try {
		const message = await $fetch<EnquiryMessage>(`/api/enquiries/${number.value}/messages`, {
			method: "POST",
			body: { body: replyBody.value.trim() },
		})
		replyBody.value = ""
		if (thread.value && !thread.value.messages.some(existing => existing.id === message.id)) {
			thread.value = { ...thread.value, messages: [...thread.value.messages, message] }
		}
		scrollToBottom()
		await refreshList()
	}
	catch (err) {
		const fetchError = err as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to send message.")
	}
	finally {
		sending.value = false
	}
}

function handleReplyKeydown(event: KeyboardEvent) {
	if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey)) {
		return
	}

	event.preventDefault()
	sendMessage()
}

async function updatePriority(value: EnquiryPriority) {
	if (!thread.value || thread.value.priority === value) {
		editingField.value = null
		return
	}
	try {
		await $fetch(`/api/enquiries/${number.value}`, {
			method: "PATCH",
			body: { priority: value },
		})
		await Promise.all([refreshThread(), refreshList()])
		toast.success("Priority updated.")
	}
	catch (err) {
		const fetchError = err as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to update priority.")
	}
	finally {
		editingField.value = null
	}
}

async function updateStatus(value: EnquiryStatus) {
	if (!thread.value || thread.value.status === value) {
		editingField.value = null
		return
	}
	try {
		await $fetch(`/api/enquiries/${number.value}`, {
			method: "PATCH",
			body: { status: value },
		})
		await Promise.all([refreshThread(), refreshList()])
		toast.success("Status updated.")
	}
	catch (err) {
		const fetchError = err as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to update status.")
	}
	finally {
		editingField.value = null
	}
}

// Realtime: append inbound messages, refresh receipts, and reflect status changes.
onEnquiryEvent((realtimeEvent) => {
	if (realtimeEvent.enquiryNumber !== number.value || !thread.value) {
		return
	}

	if (realtimeEvent.type === "message") {
		if (thread.value.messages.some(existing => existing.id === realtimeEvent.message.id)) {
			return
		}
		thread.value = { ...thread.value, messages: [...thread.value.messages, realtimeEvent.message] }
		scrollToBottom()
		if (realtimeEvent.message.senderSide !== thread.value.viewerSide) {
			void markThreadRead()
		}
		void refreshList()
	}
	else if (realtimeEvent.type === "read") {
		thread.value = realtimeEvent.side === "customer"
			? { ...thread.value, customerLastReadMessageId: realtimeEvent.lastReadMessageId }
			: { ...thread.value, supportLastReadMessageId: realtimeEvent.lastReadMessageId }
	}
	else if (realtimeEvent.type === "status") {
		thread.value = { ...thread.value, status: realtimeEvent.status, priority: realtimeEvent.priority }
	}
})

onMounted(() => {
	setActiveEnquiry(number.value)
	scrollToBottom()
	void markThreadRead()
})

watch(number, (next, previous) => {
	if (next && next !== previous) {
		setActiveEnquiry(next)
		scrollToBottom()
		void markThreadRead()
	}
})

onScopeDispose(() => {
	setActiveEnquiry(null)
})
</script>

<template>
	<div class="flex flex-col gap-6 xl:min-h-0 xl:flex-1">
		<NuxtLink
			to="/enquiries"
			class="text-muted-foreground hover:text-primary inline-flex items-center gap-2 text-[0.68rem] font-bold tracking-[0.16em] uppercase transition-colors"
		>
			<ArrowLeft class="size-3.5" />
			Back to Enquiries
		</NuxtLink>

		<div
			v-if="pending"
			class="border-border/60 bg-card rounded-md border p-12 text-center"
		>
			<p class="text-muted-foreground text-sm">
				Loading communication hub…
			</p>
		</div>

		<div
			v-else-if="error || !thread"
			class="border-destructive/30 bg-destructive/5 rounded-md border p-8 text-center"
		>
			<p class="text-destructive text-sm">
				Unable to load enquiry thread.
			</p>
		</div>

		<section
			v-else
			class="grid gap-5 xl:min-h-0 xl:flex-1 xl:grid-cols-[18rem_1fr_16rem] xl:grid-rows-1"
		>
			<aside class="border-border/60 bg-card rounded-md border xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden">
				<header class="border-border/40 border-b p-4">
					<p
						class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase"
						style="font-family: var(--font-display);"
					>
						Enquiry History
					</p>

					<p class="text-muted-foreground mt-1 text-xs">
						{{ enquiries?.length ?? 0 }} active threads
					</p>
				</header>

				<ul class="max-h-128 space-y-0.5 overflow-y-auto p-2 xl:max-h-none xl:flex-1">
					<li
						v-for="row in enquiries ?? []"
						:key="row.id"
					>
						<NuxtLink
							:to="`/enquiries/${row.enquiryNumber}`"
							class="block rounded-md p-3 transition-all"
							:class="row.enquiryNumber === thread.enquiryNumber
								? 'bg-primary text-primary-foreground'
								: 'hover:bg-muted text-foreground'"
						>
							<div class="flex items-center justify-between gap-2">
								<span
									class="text-[0.6rem] font-bold tracking-[0.14em] uppercase"
									:class="row.enquiryNumber === thread.enquiryNumber ? 'text-primary-foreground/70' : 'text-muted-foreground'"
								>
									{{ row.enquiryNumber }}
								</span>

								<span
									v-if="(unreadMap[row.enquiryNumber] ?? 0) > 0 && row.enquiryNumber !== thread.enquiryNumber"
									class="bg-primary text-primary-foreground inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.56rem] font-bold"
								>
									{{ unreadMap[row.enquiryNumber] }}
								</span>

								<span
									v-else
									class="rounded-sm px-1.5 py-0.5 text-[0.56rem] font-bold tracking-[0.12em] uppercase"
									:class="row.enquiryNumber === thread.enquiryNumber
										? 'bg-primary-foreground/20 text-primary-foreground'
										: statusStyles[row.status]"
								>
									{{ row.status }}
								</span>
							</div>

							<p
								class="mt-1.5 line-clamp-2 text-sm font-semibold"
								style="font-family: var(--font-display);"
							>
								{{ row.subject }}
							</p>

							<p
								class="mt-0.5 truncate text-[0.65rem]"
								:class="row.enquiryNumber === thread.enquiryNumber ? 'text-primary-foreground/70' : 'text-muted-foreground'"
							>
								{{ row.supplierName }}
							</p>
						</NuxtLink>
					</li>
				</ul>
			</aside>

			<div class="border-border/60 bg-card flex min-h-0 flex-col rounded-md border">
				<header class="border-border/40 flex flex-col gap-3 border-b p-6">
					<div class="flex items-center gap-2">
						<span
							v-if="thread.viewerSide === 'support'"
							class="rounded-sm px-2 py-0.5 text-[0.58rem] font-bold tracking-[0.14em] uppercase"
							:class="priorityStyles[thread.priority]"
						>
							{{ thread.priority }}
						</span>

						<span
							class="rounded-sm px-2 py-0.5 text-[0.58rem] font-bold tracking-[0.14em] uppercase"
							:class="statusStyles[thread.status]"
						>
							{{ thread.status }}
						</span>

						<span class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.16em] uppercase">
							{{ thread.enquiryNumber }}
						</span>
					</div>

					<h1
						class="text-foreground text-2xl font-extrabold tracking-[-0.02em]"
						style="font-family: var(--font-display);"
					>
						{{ thread.subject }}
					</h1>

					<p class="text-primary text-sm font-semibold">
						{{ thread.supplierName }}
					</p>
				</header>

				<div
					ref="messagesContainer"
					class="min-h-0 flex-1 space-y-5 overflow-y-auto p-6"
				>
					<article
						v-for="message in thread.messages"
						:key="message.id"
						class="flex gap-4"
						:class="isMine(message.senderSide) ? 'flex-row-reverse' : ''"
					>
						<div
							class="flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-bold"
							:class="isMine(message.senderSide) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'"
							style="font-family: var(--font-display);"
						>
							{{ message.authorName.slice(0, 2).toUpperCase() }}
						</div>

						<div class="max-w-[78%] space-y-1.5">
							<div
								class="text-muted-foreground flex items-center gap-2 text-[0.62rem] font-bold tracking-[0.12em] uppercase"
								:class="isMine(message.senderSide) ? 'justify-end' : ''"
							>
								<span>{{ message.authorName }}</span>

								<span>·</span>

								<span>{{ message.authorRole }}</span>
							</div>

							<div
								class="rounded-md p-4 text-sm leading-6"
								:class="isMine(message.senderSide) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'"
							>
								<p>{{ message.body }}</p>

								<div
									v-if="message.attachmentName"
									class="bg-background/60 text-foreground mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-xs"
								>
									<FileText class="size-3.5 shrink-0" />

									<span class="truncate font-semibold">{{ message.attachmentName }}</span>
								</div>
							</div>

							<div
								class="text-muted-foreground flex items-center gap-1.5 text-[0.6rem]"
								:class="isMine(message.senderSide) ? 'justify-end' : ''"
							>
								<span>{{ formatDateTime(message.createdAt) }}</span>

								<span
									v-if="isMine(message.senderSide) && message.id === lastOwnMessageId && ownLatestSeen"
									class="text-primary inline-flex items-center gap-0.5 font-semibold"
								>
									<Check class="size-3" />
									Seen
								</span>
							</div>
						</div>
					</article>
				</div>

				<footer class="border-border/40 border-t p-4">
					<div class="bg-muted rounded-md p-3">
						<Textarea
							v-model="replyBody"
							rows="2"
							placeholder="Type your reply…"
							class="text-foreground placeholder:text-muted-foreground/60 w-full resize-none bg-transparent text-sm leading-6 focus:outline-none"
							:disabled="sending"
							@keydown="handleReplyKeydown"
						/>

						<div class="mt-2 flex items-center justify-between">
							<div class="text-muted-foreground flex gap-1">
								<Button
									type="button"
									class="hover:bg-background flex size-8 items-center justify-center rounded-md"
									disabled
								>
									<Bold class="size-4" />
								</Button>

								<Button
									type="button"
									class="hover:bg-background flex size-8 items-center justify-center rounded-md"
									disabled
								>
									<Italic class="size-4" />
								</Button>

								<Button
									type="button"
									class="hover:bg-background flex size-8 items-center justify-center rounded-md"
									disabled
								>
									<Paperclip class="size-4" />
								</Button>

								<Button
									type="button"
									class="hover:bg-background flex size-8 items-center justify-center rounded-md"
									disabled
								>
									<Smile class="size-4" />
								</Button>
							</div>

							<Button
								type="button"
								class="bg-primary text-primary-foreground inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-[0.62rem] font-bold tracking-[0.14em] uppercase transition-all hover:brightness-110 disabled:opacity-60"
								:disabled="sending || !replyBody.trim()"
								@click="sendMessage"
							>
								<LoaderCircle
									v-if="sending"
									class="size-3.5 animate-spin"
								/>

								<Send
									v-else
									class="size-3.5"
								/>
								Send
							</Button>
						</div>
					</div>
				</footer>
			</div>

			<aside class="space-y-3 xl:min-h-0 xl:overflow-y-auto">
				<div class="border-border/60 bg-card rounded-md border p-5">
					<div class="text-muted-foreground mb-3 flex items-center gap-2">
						<Factory class="size-4" />

						<p class="text-[0.62rem] font-bold tracking-[0.18em] uppercase">
							Supplier
						</p>
					</div>

					<p class="text-foreground text-sm font-semibold">
						{{ thread.supplierName }}
					</p>

					<p
						v-if="thread.productSku"
						class="text-muted-foreground mt-2 text-xs"
					>
						SKU: <span class="text-foreground font-mono">{{ thread.productSku }}</span>
					</p>
				</div>

				<div
					v-if="thread.viewerSide === 'support'"
					class="border-border/60 bg-card rounded-md border p-5"
				>
					<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.18em] uppercase">
						Priority
					</p>

					<div
						v-if="editingField === 'priority'"
						class="mt-3 space-y-1"
					>
						<Button
							v-for="option in priorityOptions"
							:key="option"
							type="button"
							class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[0.68rem] font-bold tracking-[0.12em] uppercase transition-all"
							:class="thread.priority === option ? priorityStyles[option] : 'text-muted-foreground hover:bg-muted'"
							@click="updatePriority(option)"
						>
							<span>{{ option }}</span>

							<span v-if="thread.priority === option">●</span>
						</Button>

						<Button
							type="button"
							class="text-muted-foreground hover:text-foreground w-full rounded-md px-2.5 py-1 text-[0.58rem] font-semibold tracking-[0.14em] uppercase"
							@click="editingField = null"
						>
							Cancel
						</Button>
					</div>

					<Button
						v-else
						type="button"
						class="mt-3 w-full rounded-md px-3 py-2 text-[0.68rem] font-bold tracking-[0.14em] uppercase transition-all hover:brightness-110"
						:class="priorityStyles[thread.priority]"
						@click="editingField = 'priority'"
					>
						{{ thread.priority }}
					</Button>
				</div>

				<div
					v-if="thread.viewerSide === 'support'"
					class="border-border/60 bg-card rounded-md border p-5"
				>
					<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.18em] uppercase">
						Status
					</p>

					<div
						v-if="editingField === 'status'"
						class="mt-3 space-y-1"
					>
						<Button
							v-for="option in statusOptions"
							:key="option"
							type="button"
							class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[0.68rem] font-bold tracking-[0.12em] uppercase transition-all"
							:class="thread.status === option ? statusStyles[option] : 'text-muted-foreground hover:bg-muted'"
							@click="updateStatus(option)"
						>
							<span>{{ option }}</span>

							<span v-if="thread.status === option">●</span>
						</Button>

						<Button
							type="button"
							class="text-muted-foreground hover:text-foreground w-full rounded-md px-2.5 py-1 text-[0.58rem] font-semibold tracking-[0.14em] uppercase"
							@click="editingField = null"
						>
							Cancel
						</Button>
					</div>

					<Button
						v-else
						type="button"
						class="mt-3 w-full rounded-md px-3 py-2 text-[0.68rem] font-bold tracking-[0.14em] uppercase transition-all hover:brightness-110"
						:class="statusStyles[thread.status]"
						@click="editingField = 'status'"
					>
						{{ thread.status }}
					</Button>
				</div>

				<div class="border-border/60 bg-card rounded-md border p-5">
					<div class="text-muted-foreground flex items-center gap-2">
						<Users class="size-4" />

						<p class="text-[0.62rem] font-bold tracking-[0.18em] uppercase">
							{{ thread.viewerSide === 'support' ? 'Customer' : 'Support' }}
						</p>
					</div>

					<p class="text-foreground mt-2 text-sm font-semibold">
						{{ thread.viewerSide === 'support'
							? (thread.customerName || thread.customerEmail || 'Customer')
							: 'SupplyKey Support' }}
					</p>

					<p
						v-if="thread.viewerSide === 'support' && thread.customerName && thread.customerEmail"
						class="text-muted-foreground mt-1 text-xs"
					>
						{{ thread.customerEmail }}
					</p>

					<div class="border-border/40 mt-3 space-y-1.5 border-t pt-3">
						<div class="flex items-center justify-between">
							<span class="text-muted-foreground text-xs">Messages</span>

							<span class="text-foreground text-xs font-semibold">{{ thread.messages.length }}</span>
						</div>

						<div class="flex items-center justify-between gap-2">
							<span class="text-muted-foreground text-xs">Last reply</span>

							<span class="text-foreground text-xs font-semibold">
								{{ lastActivity ? formatDateTime(lastActivity) : '—' }}
							</span>
						</div>
					</div>
				</div>

				<div class="border-border/60 bg-card rounded-md border p-5">
					<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.18em] uppercase">
						Thread Opened
					</p>

					<p class="text-foreground mt-2 text-sm font-semibold">
						{{ formatDateTime(thread.createdAt) }}
					</p>
				</div>
			</aside>
		</section>
	</div>
</template>
