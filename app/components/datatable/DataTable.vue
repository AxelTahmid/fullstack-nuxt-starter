<script setup lang="ts" generic="TData, TValue">
import { SearchX } from "@lucide/vue"
import type {
	ColumnDef,
	ColumnFiltersState,
	RowSelectionState,
	SortingState,
	VisibilityState,
} from "@tanstack/vue-table"
import {
	FlexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useVueTable,
} from "@tanstack/vue-table"
import { computed } from "vue"
import { Skeleton } from "@/components/ui/skeleton"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { valueUpdater } from "~/utils"

const props = defineProps<{
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
	loading?: boolean
}>()

const SKELETON_ROW_COUNT = 6

const sorting = ref<SortingState>([])
const columnFilters = ref<ColumnFiltersState>([])
const columnVisibility = ref<VisibilityState>({})
const rowSelection = ref<RowSelectionState>({})

const table = useVueTable({
	get data() {
		return props.data
	},
	get columns() {
		return props.columns
	},
	getCoreRowModel: getCoreRowModel(),
	getPaginationRowModel: getPaginationRowModel(),
	getSortedRowModel: getSortedRowModel(),
	getFilteredRowModel: getFilteredRowModel(),
	initialState: {
		pagination: {
			pageIndex: 0,
			pageSize: 50,
		},
	},
	onSortingChange: updaterOrValue => valueUpdater(updaterOrValue, sorting),
	onColumnFiltersChange: updaterOrValue =>
		valueUpdater(updaterOrValue, columnFilters),
	onColumnVisibilityChange: updaterOrValue =>
		valueUpdater(updaterOrValue, columnVisibility),
	onRowSelectionChange: updaterOrValue =>
		valueUpdater(updaterOrValue, rowSelection),
	state: {
		get sorting() {
			return sorting.value
		},
		get columnFilters() {
			return columnFilters.value
		},
		get columnVisibility() {
			return columnVisibility.value
		},
		get rowSelection() {
			return rowSelection.value
		},
	},
})

// Expose table instance for parent components to use
defineExpose({
	table,
})

// Any load — initial, pagination, search, or refresh — shows the skeleton
// instead of keeping the previous rows behind a subtle refresh indicator.
const showSkeleton = computed(() => Boolean(props.loading))
const visibleColumnCount = computed(() => {
	const count = table.getVisibleLeafColumns().length
	return count > 0 ? count : props.columns.length
})
</script>

<template>
	<div class="w-full space-y-4">
		<slot
			name="toolbar"
			:table="table"
		/>

		<div class="surface-panel surface-outline overflow-hidden rounded-[1.45rem] border">
			<Table class="min-w-full">
				<TableHeader class="bg-muted/35">
					<TableRow
						v-for="headerGroup in table.getHeaderGroups()"
						:key="headerGroup.id"
						class="border-border/60 hover:bg-transparent"
					>
						<TableHead
							v-for="header in headerGroup.headers"
							:key="header.id"
							class="text-muted-foreground h-12 px-4 text-[0.72rem] font-semibold tracking-[0.18em] uppercase"
						>
							<FlexRender
								v-if="!header.isPlaceholder"
								:render="header.column.columnDef.header"
								:props="header.getContext()"
							/>
						</TableHead>
					</TableRow>
				</TableHeader>

				<TableBody>
					<template v-if="showSkeleton">
						<TableRow
							v-for="i in SKELETON_ROW_COUNT"
							:key="`skeleton-${i}`"
							class="border-border/50 hover:bg-transparent"
						>
							<TableCell
								v-for="j in visibleColumnCount"
								:key="`skeleton-cell-${j}`"
								class="px-4 py-4"
							>
								<Skeleton class="h-5 w-full rounded-full" />
							</TableCell>
						</TableRow>
					</template>

					<template v-else-if="table.getRowModel().rows?.length">
						<TableRow
							v-for="row in table.getRowModel().rows"
							:key="row.id"
							:data-state="row.getIsSelected() && 'selected'"
							class="border-border/50 hover:bg-muted/20"
						>
							<TableCell
								v-for="cell in row.getVisibleCells()"
								:key="cell.id"
								class="px-4 py-3.5"
							>
								<FlexRender
									:render="cell.column.columnDef.cell"
									:props="cell.getContext()"
								/>
							</TableCell>
						</TableRow>
					</template>

					<template v-else>
						<TableRow>
							<TableCell
								:colspan="visibleColumnCount"
								class="h-56 px-6 py-8 text-center"
							>
								<slot name="empty">
									<div class="flex flex-col items-center justify-center gap-3">
										<div class="border-border/70 bg-muted/55 text-muted-foreground flex size-12 items-center justify-center rounded-2xl border">
											<SearchX class="size-5" />
										</div>

										<div class="space-y-1">
											<p class="font-semibold tracking-[-0.02em]">
												No results found
											</p>

											<p class="text-muted-foreground text-sm">
												Try adjusting the current filters or search terms.
											</p>
										</div>
									</div>
								</slot>
							</TableCell>
						</TableRow>
					</template>
				</TableBody>
			</Table>
		</div>

		<slot
			name="pagination"
			:table="table"
		/>
	</div>
</template>
