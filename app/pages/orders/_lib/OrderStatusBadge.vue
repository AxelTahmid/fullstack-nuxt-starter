<script setup lang="ts">
import type { OrderStatus } from "#shared/types/order"
import { Badge } from "@/components/ui/badge"

const props = defineProps<{
	status: OrderStatus
}>()

const presentation = computed(() => {
	const map: Record<OrderStatus, { label: string, variant: "default" | "secondary" | "outline", class?: string }> = {
		placed: { label: "Placed", variant: "default" },
		processing: { label: "Processing", variant: "outline" },
		shipped: { label: "Shipped", variant: "outline", class: "border-transparent bg-accent text-accent-foreground" },
		delivered: { label: "Delivered", variant: "outline", class: "border-transparent bg-success text-success-foreground" },
	}

	return map[props.status]
})
</script>

<template>
	<Badge
		:variant="presentation.variant"
		:class="presentation.class"
	>
		{{ presentation.label }}
	</Badge>
</template>
