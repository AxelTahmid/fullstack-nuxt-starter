<script setup lang="ts">
import type { Component } from "vue"
import { Card, CardContent } from "@/components/ui/card"

defineProps<{
	icon: Component
	label: string
	value: string
	sub?: string
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

			<div>
				<p
					class="text-foreground truncate text-sm font-semibold"
					:title="value"
				>
					{{ value }}
				</p>

				<p
					v-if="sub"
					class="text-muted-foreground mt-0.5 truncate font-mono text-xs"
				>
					{{ sub }}
				</p>
			</div>
		</CardContent>
	</Card>
</template>
