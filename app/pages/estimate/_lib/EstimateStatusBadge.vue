<script setup lang="ts">
import type { EstimateStatus } from "#shared/types/estimate"
import { Badge } from "@/components/ui/badge"

const props = defineProps<{
	status: EstimateStatus
}>()

const presentation = computed(() => {
	const map: Record<EstimateStatus, { label: string, variant: "default" | "secondary" | "outline", class?: string }> = {
		submitted: { label: "Awaiting pricing", variant: "default" },
		converted: { label: "Converted to order", variant: "outline", class: "border-transparent bg-success text-success-foreground" },
		expired: { label: "Expired", variant: "secondary" },
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
