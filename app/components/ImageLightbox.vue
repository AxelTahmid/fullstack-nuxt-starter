<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { ChevronLeft, ChevronRight, ImageIcon, RotateCcw, ZoomIn, ZoomOut } from "@lucide/vue"

export interface LightboxImage {
	url: string
	alt?: string | null
}

const props = withDefaults(defineProps<{
	images: readonly LightboxImage[]
	startIndex?: number
}>(), {
	startIndex: 0,
})

const open = defineModel<boolean>("open", { default: false })

const MIN_SCALE = 1
const MAX_SCALE = 4

const index = ref(props.startIndex)
const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
const dragging = ref(false)
let dragStartX = 0
let dragStartY = 0
let panStartX = 0
let panStartY = 0

const current = computed(() => props.images[index.value] ?? null)
const total = computed(() => props.images.length)
const caption = computed(() => current.value?.alt?.trim() || "")
const zoomed = computed(() => scale.value > 1)

function resetZoom() {
	scale.value = 1
	tx.value = 0
	ty.value = 0
}

function clampIndex(value: number) {
	if (total.value === 0) {
		return 0
	}
	return (value + total.value) % total.value
}

function go(to: number) {
	index.value = clampIndex(to)
	resetZoom()
}

function next() {
	go(index.value + 1)
}

function prev() {
	go(index.value - 1)
}

function setScale(value: number) {
	// Nothing to zoom into when there's no image on the stage.
	if (!current.value) {
		resetZoom()
		return
	}
	scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round(value * 100) / 100))
	if (scale.value === 1) {
		tx.value = 0
		ty.value = 0
	}
}

function zoomIn() {
	setScale(scale.value + 0.5)
}

function zoomOut() {
	setScale(scale.value - 0.5)
}

function onWheel(event: WheelEvent) {
	setScale(scale.value + (event.deltaY < 0 ? 0.25 : -0.25))
}

function toggleZoom() {
	setScale(zoomed.value ? 1 : 2.5)
}

function onPointerDown(event: PointerEvent) {
	if (!zoomed.value) {
		return
	}
	dragging.value = true
	dragStartX = event.clientX
	dragStartY = event.clientY
	panStartX = tx.value
	panStartY = ty.value
	;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
	if (!dragging.value) {
		return
	}
	tx.value = panStartX + (event.clientX - dragStartX)
	ty.value = panStartY + (event.clientY - dragStartY)
}

function onPointerUp(event: PointerEvent) {
	dragging.value = false
	;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
}

function onKeydown(event: KeyboardEvent) {
	if (!open.value) {
		return
	}
	if (event.key === "ArrowLeft") {
		prev()
	}
	else if (event.key === "ArrowRight") {
		next()
	}
	else if (event.key === "+" || event.key === "=") {
		zoomIn()
	}
	else if (event.key === "-" || event.key === "_") {
		zoomOut()
	}
	else if (event.key === "0") {
		resetZoom()
	}
}

// Sync to the requested start image each time the viewer opens, and reset zoom on close.
watch(open, (isOpen) => {
	if (isOpen) {
		// Guard against opening an empty viewer (nothing to show or zoom).
		if (total.value === 0) {
			open.value = false
			return
		}
		index.value = clampIndex(props.startIndex)
		resetZoom()
		if (import.meta.client) {
			window.addEventListener("keydown", onKeydown)
		}
	}
	else if (import.meta.client) {
		window.removeEventListener("keydown", onKeydown)
	}
})

onScopeDispose(() => {
	if (import.meta.client) {
		window.removeEventListener("keydown", onKeydown)
	}
})
</script>

<template>
	<Dialog v-model:open="open">
		<DialogContent class="flex h-[90vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
			<DialogTitle class="sr-only">
				Image viewer
			</DialogTitle>

			<DialogDescription class="sr-only">
				{{ caption || "Product image" }}
			</DialogDescription>

			<!-- Stage -->
			<div class="bg-muted/40 relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
				<div
					class="flex size-full items-center justify-center"
					:class="!current ? '' : (zoomed ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in')"
					@wheel.prevent="onWheel"
					@pointerdown="onPointerDown"
					@pointermove="onPointerMove"
					@pointerup="onPointerUp"
					@dblclick="toggleZoom"
				>
					<img
						v-if="current"
						:src="current.url"
						:alt="current.alt || 'Product image'"
						draggable="false"
						class="max-h-full max-w-full select-none object-contain transition-transform duration-100"
						:style="{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }"
					>

					<div
						v-else
						class="text-muted-foreground flex flex-col items-center gap-2"
					>
						<ImageIcon class="size-12" />

						<span class="text-sm">No image to display</span>
					</div>
				</div>

				<!-- Prev / next -->
				<Button
					v-if="total > 1"
					type="button"
					variant="secondary"
					size="icon"
					class="absolute top-1/2 left-3 size-10 -translate-y-1/2 rounded-full opacity-90 shadow-sm"
					aria-label="Previous image"
					@click="prev"
				>
					<ChevronLeft class="size-5" />
				</Button>

				<Button
					v-if="total > 1"
					type="button"
					variant="secondary"
					size="icon"
					class="absolute top-1/2 right-3 size-10 -translate-y-1/2 rounded-full opacity-90 shadow-sm"
					aria-label="Next image"
					@click="next"
				>
					<ChevronRight class="size-5" />
				</Button>

				<!-- Zoom controls -->
				<div
					v-if="current"
					class="bg-background/85 absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border p-1 shadow-sm backdrop-blur"
				>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Zoom out"
						:disabled="scale <= 1"
						@click="zoomOut"
					>
						<ZoomOut class="size-4" />
					</Button>

					<span class="text-muted-foreground w-12 text-center text-xs font-medium tabular-nums">
						{{ Math.round(scale * 100) }}%
					</span>

					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Zoom in"
						:disabled="scale >= 4"
						@click="zoomIn"
					>
						<ZoomIn class="size-4" />
					</Button>

					<Separator
						orientation="vertical"
						class="mx-0.5 h-5"
					/>

					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Reset zoom"
						:disabled="!zoomed"
						@click="resetZoom"
					>
						<RotateCcw class="size-4" />
					</Button>
				</div>

				<!-- Counter -->
				<span
					v-if="total > 1"
					class="bg-background/85 text-muted-foreground absolute top-3 left-3 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums backdrop-blur"
				>
					{{ index + 1 }} / {{ total }}
				</span>
			</div>

			<!-- Caption + thumbnails -->
			<div class="bg-background border-t">
				<p
					v-if="caption"
					class="text-muted-foreground truncate px-4 pt-3 text-sm"
				>
					{{ caption }}
				</p>

				<div
					v-if="total > 1"
					class="flex gap-2 overflow-x-auto p-3"
				>
					<button
						v-for="(img, i) in images"
						:key="i"
						type="button"
						class="size-16 shrink-0 overflow-hidden rounded-md border transition-colors"
						:class="i === index ? 'border-primary ring-primary/30 ring-2' : 'border-border hover:border-primary/50'"
						@click="go(i)"
					>
						<img
							:src="img.url"
							:alt="img.alt || `Image ${i + 1}`"
							class="size-full object-cover"
						>
					</button>
				</div>
			</div>
		</DialogContent>
	</Dialog>
</template>
