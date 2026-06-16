<script setup lang="ts">
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar"
import { FileStack, Inbox, LayoutDashboard, MessagesSquare, Palette, Receipt, ShoppingBasket, ShoppingCart, Store } from "@lucide/vue"
import type { AppNavItem } from "~/components/app-shell"
import { useBrand } from "~/composables/useBrand"

const route = useRoute()
const { brand } = useBrand()
const orgName = computed(() => brand.value?.orgName ?? "SupplyKey")
const tagline = computed(() => brand.value?.tagline ?? "Mine Supply Company")
const logoDataUrl = computed(() => brand.value?.logoDataUrl ?? null)
const initials = computed(() => orgName.value.slice(0, 2).toUpperCase())

const menuGroups = computed(() => [
	{
		title: "Operations",
		items: [
			{
				label: "Dashboard",
				description: "Command overview",
				href: "/dashboard",
				icon: LayoutDashboard,
			},
			{
				label: "Shop",
				description: "Industrial catalog",
				href: "/shop",
				icon: Store,
			},
			{
				label: "Cart",
				description: "Active order in build",
				href: "/cart",
				icon: ShoppingCart,
			},
			{
				label: "Orders",
				description: "Submitted orders",
				href: "/orders",
				icon: Receipt,
			},
		] satisfies AppNavItem[],
	},
	{
		title: "Procurement",
		items: [
			{
				label: "Estimates",
				description: "Quote requests and history",
				href: "/estimate",
				icon: ShoppingBasket,
			},
			{
				label: "Contract Pricing",
				description: "Contract catalog",
				href: "/rfp",
				icon: FileStack,
			},
		] satisfies AppNavItem[],
	},
	{
		title: "Communications",
		items: [
			{
				label: "Enquiries",
				description: "Supplier follow-ups",
				href: "/enquiries",
				icon: Inbox,
			},
			{
				label: "Communication Hub",
				description: "Threaded messaging",
				href: "/enquiries",
				icon: MessagesSquare,
			},
		] satisfies AppNavItem[],
	},
	{
		title: "Settings",
		items: [
			{
				label: "Branding",
				description: "Logo and color scheme",
				href: "/settings/branding",
				icon: Palette,
			},
		] satisfies AppNavItem[],
	},
])

function isActive(path: string) {
	if (path === "/dashboard")
		return route.path === "/dashboard"
	return route.path === path || route.path.startsWith(`${path}/`)
}
</script>

<template>
	<Sidebar collapsible="icon">
		<SidebarHeader class="p-2.5 group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:py-2">
			<SidebarMenu class="border-sidebar-border/60 border-b pb-3 group-data-[collapsible=icon]:pb-2">
				<SidebarMenuItem>
					<SidebarMenuButton
						as-child
						size="lg"
						class="h-auto rounded-md px-2.5 py-2.5 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0"
					>
						<NuxtLink to="/dashboard">
							<div
								class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-10 items-center justify-center overflow-hidden rounded-md text-sm font-extrabold tracking-[-0.04em] group-data-[collapsible=icon]:size-8"
								style="font-family: var(--font-display);"
							>
								<img
									v-if="logoDataUrl"
									:src="logoDataUrl"
									alt=""
									class="size-7 object-contain"
								>

								<span v-else>{{ initials }}</span>
							</div>

							<div class="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
								<span
									class="truncate text-[0.8rem] font-extrabold tracking-[0.08em] uppercase"
									style="font-family: var(--font-display);"
								>
									{{ orgName }}
								</span>

								<span class="text-sidebar-foreground/60 truncate text-[0.65rem] font-semibold tracking-[0.18em] uppercase">
									{{ tagline }}
								</span>
							</div>
						</NuxtLink>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		</SidebarHeader>

		<SidebarContent class="overflow-x-hidden px-2.5 pb-2.5 scrollbar-none group-data-[collapsible=icon]:px-1.5 [&::-webkit-scrollbar]:hidden">
			<SidebarGroup
				v-for="group in menuGroups"
				:key="group.title"
			>
				<SidebarGroupLabel class="text-sidebar-foreground/45 px-3 text-[0.62rem] font-bold tracking-[0.22em] uppercase">
					{{ group.title }}
				</SidebarGroupLabel>

				<SidebarGroupContent>
					<SidebarMenu>
						<SidebarMenuItem
							v-for="item in group.items"
							:key="`${group.title}-${item.label}`"
						>
							<SidebarMenuButton
								as-child
								:tooltip="item.label"
								:is-active="isActive(item.href)"
							>
								<NuxtLink :to="item.href">
									<component :is="item.icon" />

									<span>{{ item.label }}</span>
								</NuxtLink>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		</SidebarContent>

		<SidebarFooter class="mt-auto p-2.5 pt-0 group-data-[collapsible=icon]:px-1.5">
			<UserMenu />
		</SidebarFooter>
	</Sidebar>
</template>
