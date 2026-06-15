<script setup lang="ts">
import { AlertCircle } from "@lucide/vue"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
</script>

<template>
	<Alert variant="destructive">
		<AlertCircle class="size-4" />

		<AlertTitle>Could not load products</AlertTitle>

		<AlertDescription>
			Refresh the catalog or try again in a moment.
		</AlertDescription>
	</Alert>
</template>
