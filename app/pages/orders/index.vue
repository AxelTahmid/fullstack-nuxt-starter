<script setup lang="ts">
import type { PaginatedList } from "#shared/types/list"
import type { OrderSummary } from "#shared/types/order"
import type { ColumnDef } from "@tanstack/vue-table"
import { ChevronRight, PackageSearch, RefreshCw, ShoppingBag } from "@lucide/vue"
import { h, resolveComponent } from "vue"
import { Button, buttonVariants } from "@/components/ui/button"
import {
	DataTable,
	DataTablePagination,
	DataTableSearch,
	DataTableToolbar,
} from "~/components/datatable"
import OrderStatusBadge from "./_lib/OrderStatusBadge.vue"
import { formatDate, formatPrice } from "./_lib/format"

definePageMeta({
	layout: "dashboard",
	middleware: ["authenticated"],
})

useHead({
	title: "Orders",
})

const route = useRoute()

const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const pageSize = computed(() => {
	const value = Number(route.query.pageSize) || 25
	return [10, 25, 50].includes(value) ? value : 25
})
const search = computed(() => typeof route.query.search === "string" ? route.query.search : "")

const { data, pending, refresh } = await useFetch<PaginatedList<OrderSummary>>("/api/orders", {
	query: { page, pageSize, search },
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

const RouterLink = resolveComponent("NuxtLink")

const columns: ColumnDef<OrderSummary>[] = [
	{
		accessorKey: "orderNumber",
		header: "Order",
		cell: ({ row }) => h(
			RouterLink,
			{ to: `/orders/${row.original.orderNumber}`, class: "text-primary font-medium hover:underline" },
			() => row.original.orderNumber,
		),
	},
	{
		accessorKey: "status",
		header: "Status",
		cell: ({ row }) => h(OrderStatusBadge, { status: row.original.status }),
	},
	{
		accessorKey: "itemCount",
		header: "Items",
		cell: ({ row }) => h("span", { class: "text-muted-foreground text-sm tabular-nums" }, `${row.original.itemCount}`),
	},
	{
		accessorKey: "totalCents",
		header: "Total",
		cell: ({ row }) => h("span", { class: "font-medium tabular-nums" }, formatPrice(row.original.totalCents)),
	},
	{
		accessorKey: "placedAt",
		header: "Placed",
		cell: ({ row }) => h("span", { class: "text-muted-foreground text-sm" }, formatDate(row.original.placedAt)),
	},
	{
		id: "actions",
		header: () => h("span", { class: "sr-only" }, "Actions"),
		cell: ({ row }) => h(
			RouterLink,
			{
				"to": `/orders/${row.original.orderNumber}`,
				"class": "text-muted-foreground hover:text-primary flex justify-end",
				"aria-label": `View order ${row.original.orderNumber}`,
			},
			() => h(ChevronRight, { class: "size-4" }),
		),
		enableSorting: false,
		enableHiding: false,
	},
]
</script>

<template>
	<div class="space-y-6">
		<section class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
			<div class="space-y-2">
				<div class="text-muted-foreground flex items-center gap-2 text-sm font-medium">
					<PackageSearch class="size-4" />

					<span>Order history</span>
				</div>

				<h1 class="text-3xl font-semibold">
					Orders
				</h1>

				<p class="text-muted-foreground max-w-2xl text-sm leading-6">
					Orders submitted to Sage 300. Open one to review line items, totals, and status.
				</p>
			</div>

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
					:column-labels="{ orderNumber: 'Order', status: 'Status', itemCount: 'Items', totalCents: 'Total', placedAt: 'Placed' }"
				>
					<template #filters>
						<DataTableSearch
							:model-value="search"
							:min-chars="1"
							placeholder="Search by order number"
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
						<ShoppingBag class="size-6" />
					</div>

					<div class="space-y-1">
						<p class="font-medium">
							No orders yet
						</p>

						<p class="text-muted-foreground text-sm">
							Submitted orders will appear here.
						</p>
					</div>

					<NuxtLink
						to="/shop"
						:class="buttonVariants()"
					>
						Browse catalog
					</NuxtLink>
				</div>

				<div
					v-else
					class="space-y-1"
				>
					<p class="font-medium">
						No matching orders
					</p>

					<p class="text-muted-foreground text-sm">
						No orders match “{{ search }}”.
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
