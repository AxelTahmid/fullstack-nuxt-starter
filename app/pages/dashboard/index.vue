<script setup lang="ts">
import { AlertTriangle, ArrowRight, ClipboardList, FileText, MessagesSquare, RefreshCw, ShoppingBasket, ShoppingCart, Store } from "@lucide/vue"
import type { DashboardStats } from "#shared/types/dashboard"
import { useBrand } from "~/composables/useBrand"

definePageMeta({
	layout: "dashboard",
	middleware: ["authenticated"],
})

useHead({
	title: "Command Overview",
})

const { data, pending, refresh } = await useFetch<DashboardStats>("/api/dashboard/stats")

const { brand } = useBrand()
const orgName = computed(() => brand.value?.orgName ?? "SupplyKey")

const { user } = useUserSession()
const firstName = computed(() => {
	const sessionUser = user.value as { name?: string | null } | null
	const name = sessionUser?.name
	if (!name)
		return "there"
	return name.trim().split(/\s+/)[0] ?? "there"
})
const greeting = computed(() => {
	const hour = new Date().getHours()
	if (hour < 12)
		return "Good morning"
	if (hour < 17)
		return "Good afternoon"
	return "Good evening"
})

const kpiCards = computed(() => {
	const kpis = data.value?.kpis
	return [
		{
			label: "Active Orders",
			value: kpis?.activeOrders ?? 0,
			tone: "primary" as const,
			caption: "In transit or processing",
		},
		{
			label: "Pricing Agreements",
			value: kpis?.pendingRfps ?? 0,
			tone: "neutral" as const,
			caption: `Currently active with ${orgName.value}`,
		},
		{
			label: "Open Enquiries",
			value: kpis?.openEnquiries ?? 0,
			tone: "neutral" as const,
			caption: "In communication thread",
		},
		{
			label: "Estimates In Review",
			value: kpis?.estimatesInReview ?? 0,
			tone: "neutral" as const,
			caption: "Specification validation",
		},
	]
})

const projectedLabel = computed(() => {
	const cents = data.value?.kpis.projectedExpenditureCents ?? 0
	if (cents === 0)
		return "$0.00"
	const dollars = cents / 100
	if (dollars >= 1_000_000)
		return `$${(dollars / 1_000_000).toFixed(2)}M`
	if (dollars >= 1000)
		return `$${(dollars / 1000).toFixed(1)}K`
	return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
})

const supplyHealthLabel = computed(() => `${(data.value?.kpis.supplyChainHealthPct ?? 0).toFixed(1)}%`)

const quickLaunch = [
	{ label: "Order Hub", href: "/shop", icon: Store },
	{ label: "Request Estimate", href: "/estimate/new", icon: ShoppingBasket },
	{ label: "Contract Pricing", href: "/rfp", icon: FileText },
	{ label: "Enquiries", href: "/enquiries", icon: MessagesSquare },
]

const activityIconMap: Record<string, typeof ShoppingCart> = {
	ShoppingCart,
	MessagesSquare,
	ClipboardList,
}

function formatRelative(ts: string) {
	const date = new Date(ts)
	const diff = Date.now() - date.getTime()
	const minutes = Math.round(diff / 60_000)
	if (minutes < 1)
		return "just now"
	if (minutes < 60)
		return `${minutes}m ago`
	const hours = Math.round(minutes / 60)
	if (hours < 24)
		return `${hours}h ago`
	const days = Math.round(hours / 24)
	return `${days}d ago`
}
</script>

<template>
	<div class="space-y-10">
		<section class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
			<div class="space-y-2">
				<p class="text-muted-foreground text-[0.68rem] font-bold tracking-[0.24em] uppercase">
					Command Overview
				</p>

				<h1
					class="text-foreground text-5xl font-extrabold tracking-[-0.045em]"
					style="font-family: var(--font-display);"
				>
					Procurement Dashboard
				</h1>

				<p class="text-muted-foreground max-w-2xl text-sm leading-7">
					Unified view of active orders, open enquiries, and supply chain signals. Critical path items surface at the top.
				</p>
			</div>

			<Button
				type="button"
				class="border-border/70 bg-card text-foreground hover:border-primary hover:text-primary inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-[0.72rem] font-bold tracking-[0.15em] uppercase transition-all"
				@click="refresh()"
			>
				<RefreshCw
					class="size-4"
					:class="{ 'animate-spin': pending }"
				/>
				Refresh
			</Button>
		</section>

		<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			<div
				v-for="card in kpiCards"
				:key="card.label"
				class="relative flex min-h-38 flex-col justify-between rounded-md p-6"
				:class="card.tone === 'primary'
					? 'bg-primary text-primary-foreground'
					: 'bg-card text-foreground border border-border/60'"
			>
				<p
					class="text-[0.65rem] font-bold tracking-[0.2em] uppercase"
					:class="card.tone === 'primary' ? 'text-primary-foreground/70' : 'text-muted-foreground'"
				>
					{{ card.label }}
				</p>

				<div class="mt-4">
					<p
						class="metric-value text-5xl font-extrabold"
						style="font-family: var(--font-display);"
					>
						{{ pending ? "—" : card.value }}
					</p>

					<p
						class="mt-1 text-xs font-medium"
						:class="card.tone === 'primary' ? 'text-primary-foreground/70' : 'text-muted-foreground'"
					>
						{{ card.caption }}
					</p>
				</div>
			</div>
		</section>

		<section class="grid gap-4 xl:grid-cols-2">
			<div class="border-border/60 bg-card rounded-md border p-6">
				<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
					Projected Expenditure
				</p>

				<p
					class="text-foreground mt-3 text-6xl font-extrabold tracking-tighter"
					style="font-family: var(--font-display);"
				>
					{{ pending ? "—" : projectedLabel }}
				</p>

				<p class="text-muted-foreground mt-2 text-xs">
					Total of active and processing orders for this operator.
				</p>
			</div>

			<div class="border-border/60 bg-card rounded-md border p-6">
				<p class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
					Supply Chain Health
				</p>

				<p
					class="text-foreground mt-3 text-6xl font-extrabold tracking-tighter"
					style="font-family: var(--font-display);"
				>
					{{ pending ? "—" : supplyHealthLabel }}
				</p>

				<p class="text-muted-foreground mt-2 text-xs">
					Composite index from vendor uptime, on-time delivery, and compliance signals.
				</p>
			</div>
		</section>

		<section class="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
			<div class="border-border/60 bg-card rounded-md border p-6">
				<div class="mb-5 flex items-center justify-between">
					<h2
						class="text-foreground text-lg font-extrabold tracking-[-0.02em]"
						style="font-family: var(--font-display);"
					>
						Critical Action Queue
					</h2>

					<span class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.2em] uppercase">
						{{ data?.criticalActions.length ?? 0 }} Items
					</span>
				</div>

				<div
					v-if="pending"
					class="space-y-3"
				>
					<div
						v-for="i in 3"
						:key="i"
						class="bg-muted h-20 animate-pulse rounded-md"
					/>
				</div>

				<div
					v-else-if="!data?.criticalActions.length"
					class="bg-muted rounded-md p-6 text-center"
				>
					<p class="text-muted-foreground text-sm">
						No critical actions. Supply chain is operating within parameters.
					</p>
				</div>

				<ul
					v-else
					class="space-y-3"
				>
					<li
						v-for="action in data.criticalActions"
						:key="action.id"
						class="bg-muted flex items-start gap-4 rounded-md p-4"
					>
						<div
							class="flex size-10 shrink-0 items-center justify-center rounded-md"
							:class="action.priority === 'high' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'"
						>
							<AlertTriangle class="size-5" />
						</div>

						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span
									class="rounded-sm px-1.5 py-0.5 text-[0.58rem] font-bold tracking-[0.14em] uppercase"
									:class="action.priority === 'high' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'"
								>
									{{ action.priority }}
								</span>

								<span class="text-muted-foreground text-[0.62rem] font-bold tracking-[0.16em] uppercase">
									{{ action.dueLabel }}
								</span>
							</div>

							<p class="text-foreground mt-1.5 truncate text-sm font-semibold">
								{{ action.title }}
							</p>

							<p class="text-muted-foreground mt-0.5 truncate text-xs">
								{{ action.detail }}
							</p>
						</div>

						<NuxtLink
							v-if="action.linkTo"
							:to="action.linkTo"
							class="border-border/70 text-muted-foreground hover:border-primary hover:text-primary flex size-9 shrink-0 items-center justify-center rounded-md border transition-all"
						>
							<ArrowRight class="size-4" />
						</NuxtLink>
					</li>
				</ul>
			</div>

			<div class="space-y-4">
				<div class="border-border/60 bg-card rounded-md border p-6">
					<h2
						class="text-muted-foreground mb-4 text-[0.68rem] font-bold tracking-[0.2em] uppercase"
						style="font-family: var(--font-display);"
					>
						Quick Launch
					</h2>

					<div class="grid grid-cols-2 gap-2">
						<NuxtLink
							v-for="action in quickLaunch"
							:key="action.label"
							:to="action.href"
							class="group bg-muted hover:bg-primary hover:text-primary-foreground flex flex-col items-start gap-3 rounded-md p-4 transition-all"
						>
							<component
								:is="action.icon"
								class="text-primary group-hover:text-primary-foreground size-5 transition-colors"
							/>

							<span
								class="text-[0.68rem] font-bold tracking-[0.15em] uppercase"
								style="font-family: var(--font-display);"
							>
								{{ action.label }}
							</span>
						</NuxtLink>
					</div>
				</div>

				<div class="border-border/60 bg-card rounded-md border p-6">
					<h2
						class="text-muted-foreground mb-4 text-[0.68rem] font-bold tracking-[0.2em] uppercase"
						style="font-family: var(--font-display);"
					>
						Recent Activity
					</h2>

					<ul
						v-if="data?.recentActivity.length"
						class="space-y-3"
					>
						<li
							v-for="activity in data.recentActivity"
							:key="activity.id"
							class="flex items-start gap-3"
						>
							<div class="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md">
								<component
									:is="activityIconMap[activity.icon] ?? ClipboardList"
									class="size-4"
								/>
							</div>

							<div class="min-w-0 flex-1">
								<p class="text-foreground truncate text-sm font-medium">
									{{ activity.label }}
								</p>

								<p class="text-muted-foreground truncate text-xs">
									{{ activity.detail }}
								</p>
							</div>

							<span class="text-muted-foreground text-[0.62rem] font-semibold tracking-wide whitespace-nowrap">
								{{ formatRelative(activity.timestamp) }}
							</span>
						</li>
					</ul>

					<p
						v-else
						class="text-muted-foreground text-xs"
					>
						No recent activity yet. Place an order to see it here.
					</p>
				</div>
			</div>
		</section>
	</div>
</template>
