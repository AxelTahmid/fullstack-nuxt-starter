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
import { FileStack, Inbox, LayoutDashboard, Palette, Receipt, ShoppingBasket, ShoppingCart, Store, Users } from "@lucide/vue"
import type { AppNavItem } from "~/components/app-shell"
import { useBrand } from "~/composables/useBrand"
import { useEnquiryStream } from "~/composables/useEnquiryStream"

type NavItem = AppNavItem & {
	adminOnly?: boolean
	customerOnly?: boolean
}

const route = useRoute()
const { user } = useUserSession()
const { brand } = useBrand()
const { totalUnread } = useEnquiryStream()
const orgName = computed(() => brand.value?.orgName ?? "SupplyKey")
const tagline = computed(() => brand.value?.tagline ?? "Mine Supply Company")
const logoDataUrl = computed(() => brand.value?.logoDataUrl ?? null)
const initials = computed(() => orgName.value.slice(0, 2).toUpperCase())
const isAdmin = computed(() => user.value?.role === "admin")

const allMenuGroups = computed<{ title: string, items: NavItem[] }[]>(() => [
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
				customerOnly: true,
			},
			{
				label: "Orders",
				description: "Submitted orders",
				href: "/orders",
				icon: Receipt,
			},
		] satisfies NavItem[],
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
		] satisfies NavItem[],
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
		] satisfies NavItem[],
	},
	{
		title: "Settings",
		items: [
			{
				label: "Users",
				description: "Account access",
				href: "/users",
				icon: Users,
				adminOnly: true,
			},
			{
				label: "Branding",
				description: "Logo and color scheme",
				href: "/settings/branding",
				icon: Palette,
				adminOnly: true,
			},
		] satisfies NavItem[],
	},
])

const menuGroups = computed(() => allMenuGroups.value
	.map(group => ({
		...group,
		items: group.items.filter(item => (!item.adminOnly || isAdmin.value) && (!item.customerOnly || !isAdmin.value)),
	}))
	.filter(group => group.items.length > 0))

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

									<span
										v-if="item.href === '/enquiries' && totalUnread > 0"
										class="bg-primary text-primary-foreground ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.6rem] font-bold group-data-[collapsible=icon]:hidden"
									>
										{{ totalUnread }}
									</span>
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
