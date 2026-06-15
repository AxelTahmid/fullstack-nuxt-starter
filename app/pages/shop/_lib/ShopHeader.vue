<script setup lang="ts">
import { PackageSearch, RefreshCw, ShoppingCart } from "@lucide/vue"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"

defineProps<{
	pending: boolean
	cartItemCount: number
}>()

const emit = defineEmits<{
	refresh: []
}>()
</script>

<template>
	<section class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
		<div class="space-y-2">
			<div class="flex items-center gap-2 text-sm font-medium text-muted-foreground">
				<PackageSearch class="size-4" />

				<span>Sage catalog</span>
			</div>

			<h1 class="text-3xl font-semibold">
				Shop products
			</h1>

			<p class="max-w-2xl text-sm leading-6 text-muted-foreground">
				Browse Sage 300 inventory, filter by catalog attributes, and add items without exposing Sage calls to the frontend.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<Button
				type="button"
				variant="outline"
				:disabled="pending"
				@click="emit('refresh')"
			>
				<RefreshCw
					class="size-4"
					:class="{ 'animate-spin': pending }"
				/>
				Refresh
			</Button>

			<NuxtLink
				to="/cart"
				:class="buttonVariants({ variant: 'default' })"
			>
				<ShoppingCart class="size-4" />
				Cart
				<Badge
					as="span"
					variant="secondary"
					class="ml-1"
				>
					{{ cartItemCount }}
				</Badge>
			</NuxtLink>
		</div>
	</section>
</template>
