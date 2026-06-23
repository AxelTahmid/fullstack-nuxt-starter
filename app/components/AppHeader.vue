<script setup lang="ts">
import { ShoppingCart } from "@lucide/vue"
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useCart } from "~/composables/useCart"
import type { AppBreadcrumbItem } from "~/components/app-shell"

const {
	breadcrumbs,
	showBreadcrumbs = true,
	showSidebarTrigger = true,
	showThemeToggle = true,
} = defineProps<{
	breadcrumbs?: AppBreadcrumbItem[]
	showBreadcrumbs?: boolean
	showSidebarTrigger?: boolean
	showThemeToggle?: boolean
}>()

const route = useRoute()
const { user } = useUserSession()
// The cart belongs to customers; admins triage and fulfil rather than shop.
const isCustomer = computed(() => user.value?.role === "customer")
const cart = useCart()
onMounted(() => {
	if (isCustomer.value) {
		cart.refresh()
	}
})

const generatedBreadcrumbItems = computed<AppBreadcrumbItem[]>(() => {
	const segments = route.path.split("/").filter(Boolean)
	const items: AppBreadcrumbItem[] = [
		{
			label: "Dashboard",
			href: route.path === "/dashboard" ? undefined : "/dashboard",
		},
	]

	let currentPath = ""
	for (const segment of segments) {
		if (segment === "dashboard") {
			continue
		}

		currentPath += `/${segment}`

		items.push({
			label: segment
				.split("-")
				.map(word => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" "),
			href: currentPath === route.path ? undefined : currentPath,
		})
	}

	return items
})

const breadcrumbItems = computed(() => breadcrumbs ?? generatedBreadcrumbItems.value)
</script>

<template>
	<header class="border-border/60 bg-background/72 sticky top-0 z-10 flex h-18 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-xl md:px-8">
		<SidebarTrigger
			v-if="showSidebarTrigger"
			class="shrink-0"
		/>

		<div class="flex min-w-0 flex-1 items-center gap-3">
			<Breadcrumb v-if="showBreadcrumbs && breadcrumbItems.length">
				<BreadcrumbList>
					<template
						v-for="(item, index) in breadcrumbItems"
						:key="item.href ?? `${item.label}-${index}`"
					>
						<BreadcrumbItem>
							<BreadcrumbLink
								v-if="item.href"
								as-child
							>
								<NuxtLink :to="item.href">
									{{ item.label }}
								</NuxtLink>
							</BreadcrumbLink>

							<BreadcrumbPage v-else>
								{{ item.label }}
							</BreadcrumbPage>
						</BreadcrumbItem>

						<BreadcrumbSeparator v-if="index < breadcrumbItems.length - 1" />
					</template>
				</BreadcrumbList>
			</Breadcrumb>

			<div class="bg-border/70 hidden h-5 w-px lg:block" />

			<div class="border-border/70 bg-card/78 text-muted-foreground hidden items-center gap-2 rounded-md border px-3 py-1 text-[0.62rem] font-bold tracking-[0.16em] uppercase lg:flex">
				<span class="status-dot text-primary" />
				SupplyKey Console
			</div>
		</div>

		<div class="ml-auto flex items-center gap-2">
			<NuxtLink
				v-if="isCustomer"
				to="/cart"
				class="border-border/70 bg-card text-foreground hover:border-primary hover:text-primary relative inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[0.62rem] font-bold tracking-[0.16em] uppercase transition-all"
			>
				<ShoppingCart class="size-4" />

				<span class="hidden md:inline">Cart</span>

				<span
					v-if="cart.summary.value.itemCount > 0"
					class="bg-primary text-primary-foreground absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full text-[0.58rem] font-bold tabular-nums"
				>
					{{ cart.summary.value.itemCount }}
				</span>
			</NuxtLink>

			<ThemeToggle v-if="showThemeToggle" />
		</div>
	</header>
</template>
