<script setup lang="ts">
import type { EnquiryMessage, EnquiryPriority, EnquiryReadResponse, EnquiryStatus, EnquirySummary, EnquiryThread, MessageSenderSide } from "#shared/types/enquiry"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Check, FileText, Link2, LoaderCircle, Lock, LockOpen, Package, Send } from "@lucide/vue"
import type { FetchError } from "ofetch"
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

// Keeps the shared enquiries list cache fresh so the index reflects replies/status
// changes when the user navigates back; the list itself is no longer shown here.
const { refresh: refreshList } = await useFetch<EnquirySummary[]>("/api/enquiries")

const { clearUnread, setActiveEnquiry, onEnquiryEvent } = useEnquiryStream()

useHead({
	title: computed(() => thread.value ? `${thread.value.enquiryNumber} · ${thread.value.subject}` : "Enquiry"),
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

// Link to the Sage document this enquiry references, if any.
const linkedDocument = computed(() => {
	const t = thread.value
	if (!t || !t.sourceReference || t.sourceType === "general") {
		return null
	}
	if (t.sourceType === "order") {
		return { label: `Order ${t.sourceReference}`, to: `/orders/${t.sourceReference}` }
	}
	if (t.sourceType === "quote") {
		return { label: `Quote ${t.sourceReference}`, to: `/estimate/${t.sourceReference}` }
	}
	return null
})

const replyBody = ref("")
const sending = ref(false)
const updatingClosed = ref(false)
const messagesContainer = useTemplateRef<HTMLElement>("messagesContainer")

// A resolved enquiry is treated as closed: the customer can no longer reply.
const isClosed = computed(() => thread.value?.status === "resolved")
const customerLockedOut = computed(() => isClosed.value && thread.value?.viewerSide === "customer")

const participantLabel = computed(() => thread.value?.viewerSide === "support" ? "Customer" : "Support")
const participantName = computed(() => thread.value?.viewerSide === "support"
	? (thread.value?.customerName || thread.value?.customerEmail || "Customer")
	: "SupplyKey Support")

function scrollToBottom() {
	nextTick(() => {
		const el = messagesContainer.value
		if (!el) {
			return
		}
		el.scrollTop = el.scrollHeight
		// A second pass after the browser settles layout (fonts, flex sizing) so we
		// reliably land on the newest message on first open, not just on resize.
		requestAnimationFrame(() => {
			el.scrollTop = el.scrollHeight
		})
	})
}

/** Whether the reader is already at/near the newest message (so we don't yank them). */
function isNearBottom() {
	const el = messagesContainer.value
	if (!el) {
		return true
	}
	return el.scrollHeight - el.scrollTop - el.clientHeight < 160
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
}

async function updateStatus(value: EnquiryStatus) {
	if (!thread.value || thread.value.status === value) {
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
}

// Closing resolves the enquiry and locks the customer out of replying; reopening
// puts it back in the support queue.
async function setClosed(closed: boolean) {
	if (!thread.value) {
		return
	}
	updatingClosed.value = true
	try {
		await $fetch(`/api/enquiries/${number.value}`, {
			method: "PATCH",
			body: { status: closed ? "resolved" : "received" },
		})
		await Promise.all([refreshThread(), refreshList()])
		toast.success(closed ? "Enquiry closed." : "Enquiry reopened.")
	}
	catch (err) {
		const fetchError = err as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to update enquiry.")
	}
	finally {
		updatingClosed.value = false
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
		const stick = isNearBottom()
		thread.value = { ...thread.value, messages: [...thread.value.messages, realtimeEvent.message] }
		if (stick) {
			scrollToBottom()
		}
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

// Land on the newest message on first paint and whenever a different thread loads.
// `flush: post` runs after the DOM updates so the scroll height is final.
// `immediate` covers the very first open (SSR-hydrated thread); `flush: post` waits
// for the DOM so scrollHeight is final. Also re-runs when switching threads.
watch(() => thread.value?.id, () => scrollToBottom(), { flush: "post", immediate: true })

onMounted(() => {
	setActiveEnquiry(number.value)
	scrollToBottom()
	void markThreadRead()
})

watch(number, (next, previous) => {
	if (next && next !== previous) {
		setActiveEnquiry(next)
		void markThreadRead()
	}
})

onScopeDispose(() => {
	setActiveEnquiry(null)
})
</script>

<template>
	<div class="flex flex-col gap-4 xl:min-h-0 xl:flex-1">
		<Button
			as-child
			variant="ghost"
			size="sm"
			class="w-fit px-2"
		>
			<NuxtLink to="/enquiries">
				<ArrowLeft class="size-4" />
				Back to enquiries
			</NuxtLink>
		</Button>

		<div
			v-if="pending"
			class="text-muted-foreground rounded-lg border p-12 text-center text-sm"
		>
			Loading enquiry…
		</div>

		<div
			v-else-if="error || !thread"
			class="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-8 text-center text-sm"
		>
			Unable to load enquiry thread.
		</div>

		<div
			v-else
			class="mx-auto grid w-full max-w-5xl gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_18rem] xl:grid-rows-1"
		>
			<!-- Conversation -->
			<Card class="flex min-h-0 flex-col gap-0 overflow-hidden py-0">
				<CardHeader class="gap-2 border-b py-4">
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-muted-foreground font-mono text-xs">
							{{ thread.enquiryNumber }}
						</span>

						<Badge
							v-if="thread.viewerSide === 'support'"
							class="capitalize"
							:class="priorityVariants[thread.priority]"
						>
							{{ thread.priority }}
						</Badge>

						<Badge
							class="capitalize"
							:class="statusVariants[thread.status]"
						>
							{{ thread.status }}
						</Badge>
					</div>

					<h1 class="text-xl font-semibold tracking-tight">
						{{ thread.subject }}
					</h1>

					<p class="text-muted-foreground text-sm">
						{{ thread.supplierName }}
					</p>
				</CardHeader>

				<div
					ref="messagesContainer"
					class="min-h-0 flex-1 space-y-5 overflow-y-auto p-4"
				>
					<div
						v-for="message in thread.messages"
						:key="message.id"
						class="flex gap-3"
						:class="isMine(message.senderSide) ? 'flex-row-reverse' : ''"
					>
						<div
							class="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
							:class="isMine(message.senderSide) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'"
						>
							{{ message.authorName.slice(0, 2).toUpperCase() }}
						</div>

						<div class="max-w-[78%] space-y-1">
							<div
								class="text-muted-foreground flex items-center gap-2 text-xs"
								:class="isMine(message.senderSide) ? 'justify-end' : ''"
							>
								<span class="text-foreground font-medium">{{ message.authorName }}</span>

								<span>{{ message.authorRole }}</span>
							</div>

							<div
								class="rounded-lg px-3.5 py-2.5 text-sm leading-6"
								:class="isMine(message.senderSide) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'"
							>
								<p class="whitespace-pre-wrap">
									{{ message.body }}
								</p>

								<div
									v-if="message.attachmentName"
									class="bg-background/60 text-foreground mt-2 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs"
								>
									<FileText class="size-3.5 shrink-0" />

									<span class="truncate font-medium">{{ message.attachmentName }}</span>
								</div>
							</div>

							<div
								class="text-muted-foreground flex items-center gap-1.5 text-xs"
								:class="isMine(message.senderSide) ? 'justify-end' : ''"
							>
								<span>{{ formatDateTime(message.createdAt) }}</span>

								<span
									v-if="isMine(message.senderSide) && message.id === lastOwnMessageId && ownLatestSeen"
									class="text-primary inline-flex items-center gap-0.5 font-medium"
								>
									<Check class="size-3" />
									Seen
								</span>
							</div>
						</div>
					</div>
				</div>

				<CardFooter class="border-t p-3">
					<div
						v-if="customerLockedOut"
						class="text-muted-foreground flex w-full flex-col items-center gap-1.5 rounded-md border border-dashed px-4 py-4 text-center text-xs"
					>
						<Lock class="size-4" />
						This enquiry has been closed. You can no longer send messages.
					</div>

					<div
						v-else
						class="w-full space-y-2"
					>
						<Textarea
							v-model="replyBody"
							rows="2"
							placeholder="Type your reply…"
							class="resize-none"
							:disabled="sending"
							@keydown="handleReplyKeydown"
						/>

						<div class="flex items-center justify-between">
							<span class="text-muted-foreground text-xs">
								Press ⌘/Ctrl + Enter to send
							</span>

							<Button
								type="button"
								size="sm"
								:disabled="sending || !replyBody.trim()"
								@click="sendMessage"
							>
								<LoaderCircle
									v-if="sending"
									class="size-4 animate-spin"
								/>

								<Send
									v-else
									class="size-4"
								/>
								Send
							</Button>
						</div>
					</div>
				</CardFooter>
			</Card>

			<!-- Details -->
			<div class="space-y-3 xl:min-h-0 xl:overflow-y-auto">
				<!-- Triage (admin) -->
				<Card v-if="thread.viewerSide === 'support'">
					<CardContent class="space-y-4">
						<div class="space-y-1.5">
							<Label class="text-muted-foreground text-xs font-medium">Priority</Label>

							<Select
								:model-value="thread.priority"
								@update:model-value="(v) => updatePriority(v as EnquiryPriority)"
							>
								<SelectTrigger class="w-full capitalize">
									<SelectValue />
								</SelectTrigger>

								<SelectContent>
									<SelectItem
										v-for="option in priorityOptions"
										:key="option"
										:value="option"
										class="capitalize"
									>
										{{ option }}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div class="space-y-1.5">
							<Label class="text-muted-foreground text-xs font-medium">Status</Label>

							<Select
								:model-value="thread.status"
								@update:model-value="(v) => updateStatus(v as EnquiryStatus)"
							>
								<SelectTrigger class="w-full capitalize">
									<SelectValue />
								</SelectTrigger>

								<SelectContent>
									<SelectItem
										v-for="option in statusOptions"
										:key="option"
										:value="option"
										class="capitalize"
									>
										{{ option }}
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<Separator />

						<Button
							type="button"
							class="w-full"
							:variant="isClosed ? 'default' : 'outline'"
							:disabled="updatingClosed"
							@click="setClosed(!isClosed)"
						>
							<LoaderCircle
								v-if="updatingClosed"
								class="size-4 animate-spin"
							/>

							<LockOpen
								v-else-if="isClosed"
								class="size-4"
							/>

							<Lock
								v-else
								class="size-4"
							/>
							{{ isClosed ? "Reopen enquiry" : "Close enquiry" }}
						</Button>
					</CardContent>
				</Card>

				<!-- Details -->
				<Card>
					<CardContent class="space-y-4 text-sm">
						<div class="space-y-1">
							<p class="text-muted-foreground text-xs font-medium">
								Supplier
							</p>

							<p class="font-medium">
								{{ thread.supplierName }}
							</p>
						</div>

						<div
							v-if="linkedDocument || thread.productSku"
							class="space-y-1.5"
						>
							<p class="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
								<Link2 class="size-3.5" />
								Related to
							</p>

							<NuxtLink
								v-if="linkedDocument"
								:to="linkedDocument.to"
								class="text-primary flex items-center gap-1.5 font-medium hover:underline"
							>
								<FileText class="size-3.5 shrink-0" />
								{{ linkedDocument.label }}
							</NuxtLink>

							<NuxtLink
								v-if="thread.productSku"
								:to="`/shop/${thread.productSku}`"
								class="text-primary flex items-center gap-1.5 font-mono text-xs hover:underline"
							>
								<Package class="size-3.5 shrink-0" />
								{{ thread.productSku }}
							</NuxtLink>
						</div>

						<Separator />

						<div class="space-y-1">
							<p class="text-muted-foreground text-xs font-medium">
								{{ participantLabel }}
							</p>

							<p class="font-medium">
								{{ participantName }}
							</p>

							<p
								v-if="thread.viewerSide === 'support' && thread.customerName && thread.customerEmail"
								class="text-muted-foreground text-xs"
							>
								{{ thread.customerEmail }}
							</p>
						</div>

						<Separator />

						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-muted-foreground text-xs">Messages</span>

								<span class="text-xs font-medium tabular-nums">{{ thread.messages.length }}</span>
							</div>

							<div class="flex items-center justify-between gap-2">
								<span class="text-muted-foreground text-xs">Last reply</span>

								<span class="text-xs font-medium">{{ lastActivity ? formatDateTime(lastActivity) : "—" }}</span>
							</div>

							<div class="flex items-center justify-between gap-2">
								<span class="text-muted-foreground text-xs">Opened</span>

								<span class="text-xs font-medium">{{ formatDateTime(thread.createdAt) }}</span>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	</div>
</template>
