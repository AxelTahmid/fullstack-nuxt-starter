<script setup lang="ts">
import { Eye, LoaderCircle, Pencil, Plus, RefreshCw, RotateCcw, Search } from "@lucide/vue"
import type { FetchError } from "ofetch"
import type { AuditLogEntry, SageCustomerLookup, UserListRow, UserRole } from "#shared/types/user"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

async function resetPassword(user: UserListRow) {
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
	}
}

async function loadAudit(user: UserListRow) {
	selectedAuditUser.value = user
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
		<section class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
			<div class="space-y-2">
				<p class="text-muted-foreground text-sm font-semibold tracking-[0.16em] uppercase">
					Administration
				</p>

				<h1 class="text-4xl font-semibold tracking-tighter">
					Users
				</h1>

				<p class="text-muted-foreground max-w-2xl text-sm leading-7">
					Create login accounts, link customer accounts, reset credentials, and review account activity.
				</p>
			</div>

			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					class="rounded-md"
					@click="refresh"
				>
					<RefreshCw class="mr-2 size-4" />
					Refresh
				</Button>

				<Button
					class="rounded-md"
					@click="openCreate"
				>
					<Plus class="mr-2 size-4" />
					New user
				</Button>
			</div>
		</section>

		<section class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
			<div class="border-border/60 bg-card rounded-md border">
				<div class="border-border/60 flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
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

								<TableHead class="w-52 text-right">
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
									v-for="user in filteredRows"
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
											class="rounded-full capitalize"
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
											<Badge
												class="rounded-full"
												:variant="user.deactivated ? 'destructive' : 'default'"
											>
												{{ user.deactivated ? "Deactivated" : "Active" }}
											</Badge>

											<Badge
												class="rounded-full"
												variant="secondary"
											>
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
												size="sm"
												variant="ghost"
												@click="loadAudit(user)"
											>
												<Eye class="size-4" />
											</Button>

											<Button
												size="sm"
												variant="ghost"
												@click="openEdit(user)"
											>
												<Pencil class="size-4" />
											</Button>

											<Button
												size="sm"
												variant="ghost"
												:disabled="isResettingId === user.id"
												@click="resetPassword(user)"
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
			</div>

			<aside class="border-border/60 bg-card rounded-md border p-4">
				<div class="mb-4">
					<p class="text-sm font-semibold">
						Audit trail
					</p>

					<p class="text-muted-foreground text-sm">
						{{ selectedAuditUser ? selectedAuditUser.email : "Select a user to inspect activity." }}
					</p>
				</div>

				<div
					v-if="isLoadingAudit"
					class="text-muted-foreground py-8 text-center text-sm"
				>
					Loading audit...
				</div>

				<div
					v-else-if="!selectedAuditUser"
					class="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm"
				>
					Use the view action on a user row.
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
					No audit entries for this user yet.
				</div>
			</aside>
		</section>

		<Sheet v-model:open="isSheetOpen">
			<SheetContent class="w-full overflow-y-auto sm:max-w-xl">
				<SheetHeader>
					<SheetTitle>
						{{ mode === "create" ? "Create user" : "Edit user" }}
					</SheetTitle>

					<SheetDescription>
						Manage login details, role, and customer account linkage.
					</SheetDescription>
				</SheetHeader>

				<form
					class="mt-6 space-y-5"
					@submit.prevent="saveUser"
				>
					<div class="grid gap-4 md:grid-cols-2">
						<div class="space-y-2">
							<Label for="user-email">Email</Label>

							<Input
								id="user-email"
								v-model="form.email"
								type="email"
								autocomplete="email"
							/>
						</div>

						<div class="space-y-2">
							<Label for="user-name">Name</Label>

							<Input
								id="user-name"
								v-model="form.name"
								autocomplete="name"
							/>
						</div>

						<div class="space-y-2">
							<Label for="user-role">Role</Label>

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
						</div>

						<div
							v-if="mode === 'edit'"
							class="flex items-center gap-2 pt-7"
						>
							<Checkbox
								id="user-deactivated"
								v-model:checked="form.deactivated"
							/>

							<Label for="user-deactivated">Deactivated</Label>
						</div>
					</div>

					<div class="border-border/60 rounded-md border p-4">
						<div class="flex flex-col gap-3 md:flex-row md:items-end">
							<div class="flex-1 space-y-2">
								<Label for="customer-number">Customer account number</Label>

								<Input
									id="customer-number"
									v-model="form.sageCustomerNumber"
									placeholder="Customer number"
								/>
							</div>

							<Button
								type="button"
								variant="outline"
								:disabled="isLookingUpCustomer"
								@click="lookupCustomer"
							>
								<LoaderCircle
									v-if="isLookingUpCustomer"
									class="mr-2 size-4 animate-spin"
								/>
								Lookup
							</Button>
						</div>

						<div
							v-if="customerPreview"
							class="bg-muted mt-4 grid gap-3 rounded-md p-4 text-sm md:grid-cols-2"
						>
							<div>
								<p class="text-muted-foreground text-xs uppercase">
									Name
								</p>

								<p class="font-medium">
									{{ customerPreview.customerName }}
								</p>
							</div>

							<div>
								<p class="text-muted-foreground text-xs uppercase">
									Status
								</p>

								<p class="font-medium">
									{{ customerPreview.status || "Unavailable" }} · Hold {{ customerPreview.onHold || "N/A" }}
								</p>
							</div>

							<div>
								<p class="text-muted-foreground text-xs uppercase">
									Terms / price list
								</p>

								<p class="font-medium">
									{{ customerPreview.terms || "N/A" }} · {{ customerPreview.priceList || "N/A" }}
								</p>
							</div>

							<div>
								<p class="text-muted-foreground text-xs uppercase">
									Credit / balance
								</p>

								<p class="font-medium">
									{{ money(customerPreview.creditLimit) }} · {{ money(customerPreview.balanceDue) }}
								</p>
							</div>

							<div class="md:col-span-2">
								<p class="text-muted-foreground text-xs uppercase">
									Contact
								</p>

								<p class="font-medium">
									{{ customerPreview.contactName || "N/A" }} · {{ customerPreview.email || "No email" }} · {{ customerPreview.phoneNumber || "No phone" }}
								</p>
							</div>
						</div>

						<div
							v-else-if="form.sageCustomerName"
							class="bg-muted mt-4 rounded-md p-4 text-sm"
						>
							Linked to {{ form.sageCustomerName }}.
						</div>
					</div>

					<SheetFooter class="pt-4">
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
								class="mr-2 size-4 animate-spin"
							/>
							{{ mode === "create" ? "Create user" : "Save changes" }}
						</Button>
					</SheetFooter>
				</form>
			</SheetContent>
		</Sheet>
	</div>
</template>
