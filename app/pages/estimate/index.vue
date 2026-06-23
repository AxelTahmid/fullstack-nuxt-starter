<script setup lang="ts">
import type { EstimateSummary } from "#shared/types/estimate"
import type { PaginatedList } from "#shared/types/list"
import type { ColumnDef } from "@tanstack/vue-table"
import { ChevronRight, FileText, Plus, RefreshCw } from "@lucide/vue"
import { h, resolveComponent } from "vue"
import { Button, buttonVariants } from "@/components/ui/button"
import {
	DataTable,
	DataTablePagination,
	DataTableSearch,
	DataTableToolbar,
} from "~/components/datatable"
import EstimateStatusBadge from "./_lib/EstimateStatusBadge.vue"
import { formatDate, formatPrice } from "./_lib/format"

definePageMeta({
	layout: "dashboard",
	middleware: ["authenticated"],
})

useHead({
	title: "Estimates",
})

const route = useRoute()

const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const pageSize = computed(() => {
	const value = Number(route.query.pageSize) || 25
	return [10, 25, 50].includes(value) ? value : 25
})
const search = computed(() => typeof route.query.search === "string" ? route.query.search : "")

const { data, pending, refresh } = useFetch<PaginatedList<EstimateSummary>>("/api/estimates", {
	query: { page, pageSize, search },
	lazy: true,
})

const rows = computed(() => data.value?.rows ?? [])
const total = computed(() => data.value?.total ?? null)
const hasNext = computed(() => total.value === null
	? rows.value.length === pageSize.value
	: page.value * pageSize.value < total.value)

function patchQuery(patch: Record<string, string | undefined>) {
	return navigateTo({ query: { ...route.query, ...patch } })
}

function onSearch(value: string) {
	patchQuery({ page: undefined, search: value || undefined })
}

const serverPagination = computed(() => ({
	currentPage: page.value,
	perPage: pageSize.value,
	lastPage: total.value === null
		? page.value + (hasNext.value ? 1 : 0)
		: Math.max(1, Math.ceil(total.value / pageSize.value)),
	total: total.value ?? undefined,
	canPrevious: page.value > 1,
	canNext: hasNext.value,
	mode: total.value === null ? ("cursor" as const) : ("page" as const),
}))

const { user } = useUserSession()
const isAdmin = computed(() => (user.value as { role?: string } | null)?.role === "admin")

const RouterLink = resolveComponent("NuxtLink")

const columns = computed<ColumnDef<EstimateSummary>[]>(() => {
	const list: ColumnDef<EstimateSummary>[] = [
		{
			accessorKey: "quoteNumber",
			header: "Estimate",
			cell: ({ row }) => h(
				RouterLink,
				{ to: `/estimate/${row.original.quoteNumber}`, class: "text-primary font-medium hover:underline" },
				() => row.original.quoteNumber,
			),
		},
	]

	// Admins see every customer's quotes, so identify whose quote each row is.
	if (isAdmin.value) {
		list.push({
			accessorKey: "customerName",
			header: "Customer",
			cell: ({ row }) => {
				const { customerName, customerNumber } = row.original
				const children = [h("span", { class: "block truncate text-sm font-medium", title: customerName }, customerName)]
				if (customerNumber && customerNumber !== customerName)
					children.push(h("span", { class: "text-muted-foreground block truncate font-mono text-xs", title: customerNumber }, customerNumber))
				return h("div", { class: "max-w-56 leading-tight" }, children)
			},
		})
	}

	list.push(
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => h(EstimateStatusBadge, { status: row.original.status }),
		},
		{
			accessorKey: "createdAt",
			header: "Requested",
			cell: ({ row }) => h("span", { class: "text-muted-foreground text-sm" }, formatDate(row.original.createdAt)),
		},
		{
			accessorKey: "expiresAt",
			header: "Valid until",
			cell: ({ row }) => h(
				"span",
				{ class: "text-muted-foreground text-sm" },
				row.original.expiresAt ? formatDate(row.original.expiresAt) : "—",
			),
		},
		{
			accessorKey: "totalCents",
			header: "Total",
			cell: ({ row }) => h("span", { class: "font-medium tabular-nums" }, formatPrice(row.original.totalCents)),
		},
		{
			id: "actions",
			header: () => h("span", { class: "sr-only" }, "Actions"),
			cell: ({ row }) => h(
				RouterLink,
				{
					"to": `/estimate/${row.original.quoteNumber}`,
					"class": "text-muted-foreground hover:text-primary flex justify-end",
					"aria-label": `View estimate ${row.original.quoteNumber}`,
				},
				() => h(ChevronRight, { class: "size-4" }),
			),
			enableSorting: false,
			enableHiding: false,
		},
	)

	return list
})
</script>

<template>
	<div class="space-y-6">
		<section class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
			<div class="space-y-2">
				<div class="text-muted-foreground flex items-center gap-2 text-sm font-medium">
					<FileText class="size-4" />

					<span>Quotation workflow</span>
				</div>

				<h1 class="text-3xl font-semibold">
					Estimates
				</h1>

				<p class="text-muted-foreground max-w-2xl text-sm leading-6">
					Quote requests sent to SupplyKey. Open one to review line items, totals, and status.
				</p>
			</div>

			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					:disabled="pending"
					@click="() => refresh()"
				>
					<RefreshCw
						class="size-4"
						:class="{ 'animate-spin': pending }"
					/>
					Refresh
				</Button>

				<NuxtLink
					v-if="!isAdmin"
					to="/cart"
					:class="buttonVariants()"
				>
					<Plus class="size-4" />
					Request estimate
				</NuxtLink>
			</div>
		</section>

		<DataTable
			:columns="columns"
			:data="rows"
			:loading="pending"
		>
			<template #toolbar="{ table }">
				<DataTableToolbar
					:table="table"
					:custom-is-filtered="Boolean(search)"
					:on-reset="() => patchQuery({ page: undefined, search: undefined })"
					:column-labels="{ quoteNumber: 'Estimate', customerName: 'Customer', status: 'Status', createdAt: 'Requested', expiresAt: 'Valid until', totalCents: 'Total' }"
				>
					<template #filters>
						<DataTableSearch
							:model-value="search"
							:min-chars="1"
							placeholder="Search by estimate number"
							@update:model-value="onSearch"
						/>
					</template>
				</DataTableToolbar>
			</template>

			<template #empty>
				<div
					v-if="!search"
					class="flex flex-col items-center justify-center gap-3"
				>
					<div class="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
						<FileText class="size-6" />
					</div>

					<div class="space-y-1">
						<p class="font-medium">
							No estimates yet
						</p>

						<p class="text-muted-foreground text-sm">
							{{ isAdmin ? "Customer quote requests will appear here." : "Request a quote from your cart to get started." }}
						</p>
					</div>

					<NuxtLink
						v-if="!isAdmin"
						to="/cart"
						:class="buttonVariants()"
					>
						Request estimate
					</NuxtLink>
				</div>

				<div
					v-else
					class="space-y-1"
				>
					<p class="font-medium">
						No matching estimates
					</p>

					<p class="text-muted-foreground text-sm">
						No estimates match “{{ search }}”.
					</p>
				</div>
			</template>

			<template #pagination="{ table }">
				<DataTablePagination
					:table="table"
					:show-selected-rows="false"
					:page-size-options="[10, 25, 50]"
					:server-pagination="serverPagination"
					@server-page-change="(next) => patchQuery({ page: String(next) })"
					@server-page-size-change="(size) => patchQuery({ page: undefined, pageSize: String(size) })"
				/>
			</template>
		</DataTable>
	</div>
</template>
