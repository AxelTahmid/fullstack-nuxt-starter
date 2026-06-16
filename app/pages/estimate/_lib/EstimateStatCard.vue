<script setup lang="ts">
import type { Component } from "vue"
import { Card, CardContent } from "@/components/ui/card"

defineProps<{
	icon: Component
	label: string
	value: string
}>()
</script>

<template>
	<Card>
		<CardContent class="space-y-3">
			<div class="text-muted-foreground flex items-center gap-2">
				<component
					:is="icon"
					class="size-4"
				/>

				<p class="text-xs font-medium">
					{{ label }}
				</p>
			</div>

			<p class="text-foreground text-sm font-semibold">
				{{ value }}
			</p>
		</CardContent>
	</Card>
</template>
