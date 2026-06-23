<script setup lang="ts">
import type { AuditLogEntry, SageCustomerLookup, UserListRow, UserRole } from "#shared/types/user"
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Eye, LoaderCircle, Pencil, Plus, RefreshCw, RotateCcw, Search, ShieldCheck, UserCog, Users as UsersIcon, UserX } from "@lucide/vue"
import type { FetchError } from "ofetch"
import AppPagination from "~/components/AppPagination.vue"
import { toast } from "~/components/toast"

definePageMeta({
	layout: "dashboard",
	middleware: ["authenticated", "admin"],
})

useHead({
	title: "Users",
})

type UserResponse = {
	users: UserListRow[]
}

type AuditResponse = {
	audit: AuditLogEntry[]
}

const { data, pending, refresh } = await useFetch<UserResponse>("/api/users")

const searchQuery = ref("")
const isSheetOpen = ref(false)
const mode = ref<"create" | "edit">("create")
const selectedUser = ref<UserListRow | null>(null)
const selectedAuditUser = ref<UserListRow | null>(null)
const auditRows = ref<AuditLogEntry[]>([])
const isAuditOpen = ref(false)
const isSaving = ref(false)
const isLookingUpCustomer = ref(false)
const isResettingId = ref<number | null>(null)
const isLoadingAudit = ref(false)
const customerPreview = ref<SageCustomerLookup | null>(null)

const form = reactive({
	email: "",
	name: "",
	role: "customer" as UserRole,
	sageCustomerNumber: "",
	sageCustomerName: "",
	deactivated: false,
})

const rows = computed(() => data.value?.users ?? [])
const filteredRows = computed(() => {
	const query = searchQuery.value.trim().toLowerCase()
	if (!query) {
		return rows.value
	}

	return rows.value.filter(user =>
		user.email.toLowerCase().includes(query)
		|| (user.name ?? "").toLowerCase().includes(query)
		|| (user.sageCustomerNumber ?? "").toLowerCase().includes(query)
		|| (user.sageCustomerName ?? "").toLowerCase().includes(query),
	)
})

const stats = computed(() => [
	{ label: "Total users", value: rows.value.length, icon: UsersIcon },
	{ label: "Admins", value: rows.value.filter(user => user.role === "admin").length, icon: ShieldCheck },
	{ label: "Customers", value: rows.value.filter(user => user.role === "customer").length, icon: UserCog },
	{ label: "Deactivated", value: rows.value.filter(user => user.deactivated).length, icon: UserX },
])

const PAGE_SIZE = 10
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / PAGE_SIZE)))
const pagedRows = computed(() => {
	const start = (Math.min(page.value, totalPages.value) - 1) * PAGE_SIZE
	return filteredRows.value.slice(start, start + PAGE_SIZE)
})
// Reset to the first page when the search narrows the list, and keep the page in range.
watch(searchQuery, () => (page.value = 1))
watch(totalPages, (tp) => {
	if (page.value > tp) {
		page.value = tp
	}
})

const pendingReset = ref<UserListRow | null>(null)

function formatDateTime(iso: string | null) {
	if (!iso) {
		return "Never"
	}

	return new Date(iso).toLocaleString("en-CA", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	})
}

function money(value: number | null) {
	if (value === null) {
		return "Unavailable"
	}

	return new Intl.NumberFormat("en-CA", {
		style: "currency",
		currency: "CAD",
	}).format(value)
}

function resetForm() {
	form.email = ""
	form.name = ""
	form.role = "customer"
	form.sageCustomerNumber = ""
	form.sageCustomerName = ""
	form.deactivated = false
	customerPreview.value = null
}

function openCreate() {
	mode.value = "create"
	selectedUser.value = null
	resetForm()
	isSheetOpen.value = true
}

function openEdit(user: UserListRow) {
	mode.value = "edit"
	selectedUser.value = user
	form.email = user.email
	form.name = user.name ?? ""
	form.role = user.role
	form.sageCustomerNumber = user.sageCustomerNumber ?? ""
	form.sageCustomerName = user.sageCustomerName ?? ""
	form.deactivated = user.deactivated
	customerPreview.value = null
	isSheetOpen.value = true
}

async function lookupCustomer() {
	if (!form.sageCustomerNumber.trim()) {
		toast.error("Customer number is required.")
		return
	}

	isLookingUpCustomer.value = true
	try {
		const customer = await $fetch<SageCustomerLookup>(`/api/sage/customers/${encodeURIComponent(form.sageCustomerNumber.trim())}`)
		customerPreview.value = customer
		form.sageCustomerNumber = customer.customerNumber
		form.sageCustomerName = customer.customerName
		toast.success("Customer account loaded.")
	}
	catch (error) {
		const fetchError = error as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to load customer account.")
	}
	finally {
		isLookingUpCustomer.value = false
	}
}

async function saveUser() {
	if (!form.email.trim()) {
		toast.error("Email is required.")
		return
	}
	if (form.role === "customer" && !form.sageCustomerNumber.trim()) {
		toast.error("Customer users require a customer account link.")
		return
	}

	isSaving.value = true
	try {
		const body = {
			email: form.email.trim(),
			name: form.name.trim() || null,
			role: form.role,
			sageCustomerNumber: form.sageCustomerNumber.trim() || null,
			sageCustomerName: form.sageCustomerName.trim() || null,
			...(mode.value === "create" ? {} : { deactivated: form.deactivated }),
		}

		if (mode.value === "create") {
			await $fetch("/api/users", { method: "POST", body })
			toast.success("User created.")
		}
		else if (selectedUser.value) {
			await $fetch(`/api/users/${selectedUser.value.id}`, { method: "PATCH", body })
			toast.success("User updated.")
		}

		isSheetOpen.value = false
		await refresh()
	}
	catch (error) {
		const fetchError = error as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to save user.")
	}
	finally {
		isSaving.value = false
	}
}

async function confirmResetPassword() {
	const user = pendingReset.value
	if (!user) {
		return
	}
	isResettingId.value = user.id
	try {
		await $fetch(`/api/users/${user.id}/password/reset`, { method: "POST" })
		toast.success("Temporary password sent.")
		await refresh()
	}
	catch (error) {
		const fetchError = error as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to reset password.")
	}
	finally {
		isResettingId.value = null
		pendingReset.value = null
	}
}

async function loadAudit(user: UserListRow) {
	selectedAuditUser.value = user
	auditRows.value = []
	isAuditOpen.value = true
	isLoadingAudit.value = true
	try {
		const response = await $fetch<AuditResponse>(`/api/users/${user.id}/audit`)
		auditRows.value = response.audit
	}
	catch (error) {
		const fetchError = error as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to load audit trail.")
	}
	finally {
		isLoadingAudit.value = false
	}
}
</script>

<template>
	<div class="space-y-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div class="space-y-1">
				<h1 class="text-2xl font-semibold tracking-tight">
					Users
				</h1>

				<p class="text-muted-foreground text-sm">
					Create login accounts, link customer accounts, reset credentials, and review account activity.
				</p>
			</div>

			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					@click="refresh"
				>
					<RefreshCw class="size-4" />
					Refresh
				</Button>

				<Button @click="openCreate">
					<Plus class="size-4" />
					New user
				</Button>
			</div>
		</div>

		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			<div
				v-for="stat in stats"
				:key="stat.label"
				class="bg-card flex items-center gap-3 rounded-lg border p-4"
			>
				<div class="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-md">
					<component
						:is="stat.icon"
						class="size-4.5"
					/>
				</div>

				<div>
					<p class="text-2xl font-semibold tabular-nums">
						{{ stat.value }}
					</p>

					<p class="text-muted-foreground text-xs">
						{{ stat.label }}
					</p>
				</div>
			</div>
		</div>

		<div class="bg-card rounded-lg border">
			<div class="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
				<div class="relative max-w-md flex-1">
					<Search class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />

					<Input
						v-model="searchQuery"
						placeholder="Search email, name, or customer"
						class="pl-9"
					/>
				</div>

				<p class="text-muted-foreground text-sm">
					{{ filteredRows.length }} of {{ rows.length }} users
				</p>
			</div>

			<div class="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>User</TableHead>

							<TableHead>Role</TableHead>

							<TableHead>Customer account</TableHead>

							<TableHead>Status</TableHead>

							<TableHead>Last active</TableHead>

							<TableHead class="w-44 text-right">
								Actions
							</TableHead>
						</TableRow>
					</TableHeader>

					<TableBody>
						<TableRow v-if="pending">
							<TableCell
								colspan="6"
								class="text-muted-foreground h-24 text-center"
							>
								Loading users...
							</TableCell>
						</TableRow>

						<TableRow v-else-if="!filteredRows.length">
							<TableCell
								colspan="6"
								class="text-muted-foreground h-24 text-center"
							>
								No users match this search.
							</TableCell>
						</TableRow>

						<template v-else>
							<TableRow
								v-for="user in pagedRows"
								:key="user.id"
							>
								<TableCell>
									<div class="space-y-1">
										<p class="font-medium">
											{{ user.name || user.email }}
										</p>

										<p class="text-muted-foreground text-sm">
											{{ user.email }}
										</p>
									</div>
								</TableCell>

								<TableCell>
									<Badge
										class="capitalize"
										:variant="user.role === 'admin' ? 'default' : 'secondary'"
									>
										{{ user.role }}
									</Badge>
								</TableCell>

								<TableCell>
									<div
										v-if="user.sageCustomerNumber"
										class="space-y-1"
									>
										<p class="font-medium">
											{{ user.sageCustomerNumber }}
										</p>

										<p class="text-muted-foreground text-sm">
											{{ user.sageCustomerName || "Name unavailable" }}
										</p>
									</div>

									<span
										v-else
										class="text-muted-foreground text-sm"
									>
										Not linked
									</span>
								</TableCell>

								<TableCell>
									<div class="flex flex-wrap gap-1.5">
										<Badge :variant="user.deactivated ? 'destructive' : 'default'">
											{{ user.deactivated ? "Deactivated" : "Active" }}
										</Badge>

										<Badge variant="secondary">
											{{ user.emailVerified ? "Verified" : "Pending" }}
										</Badge>
									</div>
								</TableCell>

								<TableCell class="text-muted-foreground text-sm">
									{{ formatDateTime(user.lastActiveAt) }}
								</TableCell>

								<TableCell>
									<div class="flex justify-end gap-1">
										<Button
											size="icon-sm"
											variant="ghost"
											title="View activity"
											@click="loadAudit(user)"
										>
											<Eye class="size-4" />
										</Button>

										<Button
											size="icon-sm"
											variant="ghost"
											title="Edit user"
											@click="openEdit(user)"
										>
											<Pencil class="size-4" />
										</Button>

										<Button
											size="icon-sm"
											variant="ghost"
											title="Send temporary password"
											:disabled="isResettingId === user.id"
											@click="pendingReset = user"
										>
											<LoaderCircle
												v-if="isResettingId === user.id"
												class="size-4 animate-spin"
											/>

											<RotateCcw
												v-else
												class="size-4"
											/>
										</Button>
									</div>
								</TableCell>
							</TableRow>
						</template>
					</TableBody>
				</Table>
			</div>

			<div
				v-if="!pending && filteredRows.length"
				class="border-t p-4"
			>
				<AppPagination
					v-model:page="page"
					:total-pages="totalPages"
					:total-items="filteredRows.length"
					:page-size="PAGE_SIZE"
				/>
			</div>
		</div>

		<!-- Reset password confirmation -->
		<AlertDialog
			:open="pendingReset !== null"
			@update:open="(v: boolean) => { if (!v) pendingReset = null }"
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Send a temporary password?</AlertDialogTitle>

					<AlertDialogDescription>
						This generates a new temporary password for
						{{ pendingReset?.name || pendingReset?.email }} and emails it to them. Their current
						password will stop working.
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel @click="pendingReset = null">
						Cancel
					</AlertDialogCancel>

					<Button
						:disabled="isResettingId !== null"
						@click="confirmResetPassword"
					>
						<LoaderCircle
							v-if="isResettingId !== null"
							class="size-4 animate-spin"
						/>
						Send temporary password
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>

		<!-- Audit trail: progressive disclosure via a side sheet -->
		<Sheet v-model:open="isAuditOpen">
			<SheetContent class="flex w-full flex-col sm:max-w-md">
				<SheetHeader>
					<SheetTitle>Activity</SheetTitle>

					<SheetDescription>
						{{ selectedAuditUser ? selectedAuditUser.email : "" }}
					</SheetDescription>
				</SheetHeader>

				<div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
					<div
						v-if="isLoadingAudit"
						class="text-muted-foreground py-10 text-center text-sm"
					>
						Loading activity...
					</div>

					<ul
						v-else-if="auditRows.length"
						class="space-y-3"
					>
						<li
							v-for="entry in auditRows"
							:key="entry.id"
							class="bg-muted rounded-md p-3"
						>
							<p class="text-sm font-medium">
								{{ entry.summary }}
							</p>

							<p class="text-muted-foreground mt-1 text-xs">
								{{ entry.action }} · {{ formatDateTime(entry.createdAt) }}
							</p>
						</li>
					</ul>

					<div
						v-else
						class="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm"
					>
						No activity recorded for this user yet.
					</div>
				</div>
			</SheetContent>
		</Sheet>

		<!-- Create / edit user -->
		<Sheet v-model:open="isSheetOpen">
			<SheetContent class="flex w-full flex-col overflow-y-auto sm:max-w-xl">
				<SheetHeader>
					<SheetTitle>
						{{ mode === "create" ? "Create user" : "Edit user" }}
					</SheetTitle>

					<SheetDescription>
						Manage login details, role, and customer account linkage.
					</SheetDescription>
				</SheetHeader>

				<form
					class="flex min-h-0 flex-1 flex-col"
					@submit.prevent="saveUser"
				>
					<div class="min-h-0 flex-1 space-y-6 overflow-y-auto px-4">
						<FieldSet>
							<FieldLegend>Account</FieldLegend>

							<FieldGroup class="grid gap-4 sm:grid-cols-2">
								<Field>
									<FieldLabel for="user-email">
										Email
									</FieldLabel>

									<Input
										id="user-email"
										v-model="form.email"
										type="email"
										autocomplete="email"
									/>
								</Field>

								<Field>
									<FieldLabel for="user-name">
										Name
									</FieldLabel>

									<Input
										id="user-name"
										v-model="form.name"
										autocomplete="name"
									/>
								</Field>
							</FieldGroup>
						</FieldSet>

						<FieldSet>
							<FieldLegend>Role &amp; access</FieldLegend>

							<FieldGroup class="grid gap-4 sm:grid-cols-2">
								<Field>
									<FieldLabel for="user-role">
										Role
									</FieldLabel>

									<NativeSelect
										id="user-role"
										v-model="form.role"
									>
										<option value="customer">
											Customer
										</option>

										<option value="admin">
											Admin
										</option>
									</NativeSelect>
								</Field>

								<Field
									v-if="mode === 'edit'"
									orientation="horizontal"
									class="self-end pb-2"
								>
									<Checkbox
										id="user-deactivated"
										v-model:checked="form.deactivated"
									/>

									<FieldLabel for="user-deactivated">
										Deactivated
									</FieldLabel>
								</Field>
							</FieldGroup>
						</FieldSet>

						<FieldSet>
							<FieldLegend>Customer account</FieldLegend>

							<div class="flex flex-col gap-3 sm:flex-row sm:items-end">
								<Field class="flex-1">
									<FieldLabel for="customer-number">
										Customer account number
									</FieldLabel>

									<Input
										id="customer-number"
										v-model="form.sageCustomerNumber"
										placeholder="Customer number"
									/>
								</Field>

								<Button
									type="button"
									variant="outline"
									:disabled="isLookingUpCustomer"
									@click="lookupCustomer"
								>
									<LoaderCircle
										v-if="isLookingUpCustomer"
										class="size-4 animate-spin"
									/>
									Lookup
								</Button>
							</div>

							<div
								v-if="customerPreview"
								class="bg-muted grid gap-3 rounded-md p-4 text-sm sm:grid-cols-2"
							>
								<div>
									<p class="text-muted-foreground text-xs">
										Name
									</p>

									<p class="font-medium">
										{{ customerPreview.customerName }}
									</p>
								</div>

								<div>
									<p class="text-muted-foreground text-xs">
										Status
									</p>

									<p class="font-medium">
										{{ customerPreview.status || "Unavailable" }} · Hold {{ customerPreview.onHold || "N/A" }}
									</p>
								</div>

								<div>
									<p class="text-muted-foreground text-xs">
										Terms / price list
									</p>

									<p class="font-medium">
										{{ customerPreview.terms || "N/A" }} · {{ customerPreview.priceList || "N/A" }}
									</p>
								</div>

								<div>
									<p class="text-muted-foreground text-xs">
										Credit / balance
									</p>

									<p class="font-medium">
										{{ money(customerPreview.creditLimit) }} · {{ money(customerPreview.balanceDue) }}
									</p>
								</div>

								<div class="sm:col-span-2">
									<p class="text-muted-foreground text-xs">
										Contact
									</p>

									<p class="font-medium">
										{{ customerPreview.contactName || "N/A" }} · {{ customerPreview.email || "No email" }} · {{ customerPreview.phoneNumber || "No phone" }}
									</p>
								</div>
							</div>

							<p
								v-else-if="form.sageCustomerName"
								class="bg-muted rounded-md p-4 text-sm"
							>
								Linked to {{ form.sageCustomerName }}.
							</p>
						</FieldSet>
					</div>

					<SheetFooter>
						<Button
							type="button"
							variant="outline"
							@click="isSheetOpen = false"
						>
							Cancel
						</Button>

						<Button
							type="submit"
							:disabled="isSaving"
						>
							<LoaderCircle
								v-if="isSaving"
								class="size-4 animate-spin"
							/>
							{{ mode === "create" ? "Create user" : "Save changes" }}
						</Button>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	</div>
</template>
