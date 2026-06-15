<script setup lang="ts">
import { RefreshCw } from "@lucide/vue"
import type { ColumnDef } from "@tanstack/vue-table"
import { h } from "vue"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/utils"
import {
	DataTable,
	DataTableColumnHeader,
	DataTableFacetedFilter,
	DataTablePagination,
	DataTableToolbar,
} from "~/components/datatable"

definePageMeta({
	layout: "dashboard",
	middleware: ["authenticated"],
})

useHead({
	title: "Users",
})

type UserRow = {
	id: number
	email: string
	name: string | null
	role: "admin" | "customer"
	email_verified: boolean
	last_active_at: string | null
	created_at: string
}

const roleOptions = [
	{ label: "Admin", value: "admin" },
	{ label: "Customer", value: "customer" },
]

const verificationOptions = [
	{ label: "Verified", value: "true" },
	{ label: "Pending", value: "false" },
]

const { data, pending, refresh } = await useFetch<{ users: UserRow[] }>(
	"/api/users",
)

const rows = computed(() => data.value?.users || [])

const columns: ColumnDef<UserRow>[] = [
	{
		accessorKey: "email",
		header: ({ column }) =>
			h(DataTableColumnHeader, { column: column as never, title: "User" }),
		cell: ({ row }) => {
			const user = row.original
			return h("div", { class: "space-y-1" }, [
				h("p", { class: "font-medium" }, user.name || user.email),
				h("p", { class: "text-muted-foreground text-sm" }, user.email),
			])
		},
		filterFn: "includesString",
	},
	{
		accessorKey: "role",
		header: ({ column }) =>
			h(DataTableColumnHeader, { column: column as never, title: "Role" }),
		cell: ({ row }) => {
			const value = row.original.role
			return h(
				Badge,
				{
					class: "rounded-full capitalize",
					variant: value === "admin" ? "default" : "secondary",
				},
				() => value,
			)
		},
		filterFn: (row, columnId, filterValue) => {
			const values = filterValue as string[] | undefined
			if (!values?.length) return true
			return values.includes(String(row.getValue(columnId)))
		},
	},
	{
		accessorKey: "email_verified",
		header: ({ column }) =>
			h(DataTableColumnHeader, { column: column as never, title: "Status" }),
		cell: ({ row }) => {
			const verified = row.original.email_verified
			return h(
				Badge,
				{
					class: "rounded-full",
					variant: verified ? "default" : "secondary",
				},
				() => (verified ? "Verified" : "Pending"),
			)
		},
		filterFn: (row, columnId, filterValue) => {
			const values = filterValue as string[] | undefined
			if (!values?.length) return true
			return values.includes(String(row.getValue(columnId)))
		},
	},
	{
		accessorKey: "last_active_at",
		header: ({ column }) =>
			h(DataTableColumnHeader, {
				column: column as never,
				title: "Last active",
			}),
		cell: ({ row }) =>
			h(
				"span",
				{ class: "text-sm text-muted-foreground" },
				formatDateTime(row.original.last_active_at),
			),
	},
	{
		accessorKey: "created_at",
		header: ({ column }) =>
			h(DataTableColumnHeader, { column: column as never, title: "Created" }),
		cell: ({ row }) =>
			h(
				"span",
				{ class: "text-sm text-muted-foreground" },
				formatDateTime(row.original.created_at),
			),
	},
]
</script>

<template>
	<div class="space-y-6">
		<section class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
			<div class="space-y-2">
				<p class="text-muted-foreground text-sm font-semibold tracking-[0.16em] uppercase">
					Datatable example
				</p>

				<h1 class="text-4xl font-semibold tracking-tighter">
					Users
				</h1>

				<p class="text-muted-foreground max-w-2xl text-sm leading-7">
					Client-side filtering and sorting on top of real server data, using the updated table components from `dashboard`.
				</p>
			</div>

			<Button
				variant="outline"
				class="rounded-xl"
				@click="refresh"
			>
				<RefreshCw class="mr-2 size-4" />
				Refresh
			</Button>
		</section>

		<DataTable
			:columns="columns"
			:data="rows"
			:loading="pending"
		>
			<template #toolbar="{ table }">
				<DataTableToolbar
					:table="table"
					search-key="email"
					search-placeholder="Search by email or name"
					:column-labels="{ email: 'User', role: 'Role', email_verified: 'Status', last_active_at: 'Last active', created_at: 'Created' }"
				>
					<template #filters>
						<DataTableFacetedFilter
							title="Role"
							:column="table.getColumn('role')"
							:options="roleOptions"
						/>

						<DataTableFacetedFilter
							title="Verification"
							:column="table.getColumn('email_verified')"
							:options="verificationOptions"
						/>
					</template>
				</DataTableToolbar>
			</template>

			<template #pagination="{ table }">
				<DataTablePagination
					:table="table"
					:show-selected-rows="false"
					:page-size-options="[10, 25, 50]"
				/>
			</template>
		</DataTable>
	</div>
</template>
