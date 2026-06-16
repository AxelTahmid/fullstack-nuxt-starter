<script setup lang="ts">
import { ChevronDown, LogOut } from "@lucide/vue"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { UserRole } from "#shared/types/user"

const { user, clear } = useUserSession()
const isLoading = ref(false)
const sessionUser = computed(
	() =>
		user.value as {
			email: string
			name: string | null
			role: UserRole
		} | null,
)

const displayName = computed(() => {
	return sessionUser.value?.name || sessionUser.value?.email || "User"
})

async function handleLogout() {
	isLoading.value = true
	await $fetch("/api/auth/logout", { method: "POST" })
	await clear()
	await navigateTo("/auth/login")
	isLoading.value = false
}
</script>

<template>
	<DropdownMenu>
		<DropdownMenuTrigger class="hover:bg-sidebar-accent/90 hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring flex w-full items-center gap-2.5 rounded-[0.9rem] px-2 py-1.5 text-left transition-colors group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0 focus-visible:ring-2 focus-visible:outline-none">
			<Avatar class="border-sidebar-border/70 h-9 w-9 rounded-xl border group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:border-transparent">
				<AvatarFallback class="rounded-lg">
					<ClientOnly>
						<span
							v-if="isLoading"
							class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
						></span>

						<span
							v-else
							class="text-sm font-medium uppercase"
						>
							{{ displayName.charAt(0) }}
						</span>
					</ClientOnly>
				</AvatarFallback>
			</Avatar>

			<div class="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
				<ClientOnly>
					<span class="text-sidebar-foreground truncate font-semibold">
						{{ displayName }}
					</span>

					<span class="text-sidebar-foreground/55 truncate text-xs">
						{{ sessionUser?.email || "Not signed in" }}
					</span>
				</ClientOnly>
			</div>

			<ChevronDown class="text-sidebar-foreground/45 ml-auto size-4 group-data-[collapsible=icon]:hidden" />
		</DropdownMenuTrigger>

		<DropdownMenuContent
			class="w-(--radix-dropdown-menu-trigger-width) min-w-56"
			side="bottom"
			align="end"
			:side-offset="10"
		>
			<DropdownMenuLabel class="p-1 font-normal">
				<div class="surface-panel-subtle surface-outline flex items-center gap-3 rounded-2xl border px-3 py-3 text-left text-sm">
					<Avatar class="h-10 w-10 rounded-2xl">
						<AvatarFallback class="rounded-lg text-sm font-medium uppercase">
							{{ displayName.charAt(0) }}
						</AvatarFallback>
					</Avatar>

					<div class="grid flex-1 text-left text-sm leading-tight">
						<span class="truncate font-semibold">
							{{ displayName }}
						</span>

						<span class="truncate text-xs">
							{{ sessionUser?.email }}
						</span>
					</div>
				</div>
			</DropdownMenuLabel>

			<DropdownMenuSeparator />

			<div class="px-2 py-1.5">
				<p class="text-muted-foreground text-[0.68rem] font-semibold tracking-[0.18em] uppercase">
					Current role
				</p>

				<Badge class="mt-2 rounded-full capitalize">
					{{ sessionUser?.role || "guest" }}
				</Badge>
			</div>

			<DropdownMenuSeparator />

			<DropdownMenuItem
				class="flex items-center gap-2"
				@click="handleLogout"
			>
				<LogOut class="h-4 w-4" />
				Sign out
			</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>
</template>
