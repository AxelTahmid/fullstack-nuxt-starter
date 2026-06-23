<script setup lang="ts">
import { MAX_PRODUCT_IMAGE_BYTES } from "#shared/schemas/product-image"
import type { ProductImage, ProductImageUploadTarget } from "#shared/types/product"
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { ImageIcon, LoaderCircle, Star, Trash2, Upload, ZoomIn } from "@lucide/vue"
import type { FetchError } from "ofetch"
import ImageLightbox from "~/components/ImageLightbox.vue"
import { toast } from "~/components/toast"

const props = defineProps<{
	sourceKey: string
	productName: string
	isAdmin: boolean
	initialImages: ProductImage[]
}>()

const ACCEPTED = "image/png,image/jpeg,image/webp,image/gif,image/avif"

const images = ref<ProductImage[]>([...props.initialImages])
watch(() => props.initialImages, value => (images.value = [...value]))

const selected = ref(0)
const selectedImage = computed(() => images.value[selected.value] ?? images.value[0] ?? null)

const fileInput = useTemplateRef<HTMLInputElement>("fileInput")
const uploading = ref(false)
const busyId = ref<number | null>(null)
const isDragging = ref(false)

const lightboxOpen = ref(false)
const lightboxIndex = ref(0)

const pendingDelete = ref<ProductImage | null>(null)

function openLightbox(i: number) {
	if (!images.value.length) {
		return
	}
	lightboxIndex.value = i
	lightboxOpen.value = true
}

async function refreshImages() {
	images.value = await $fetch<ProductImage[]>("/api/admin/product-images", {
		query: { sourceKey: props.sourceKey },
	})
	if (selected.value >= images.value.length) {
		selected.value = 0
	}
}

/** Client-side gate: reject wrong types / oversize files before we presign anything. */
function acceptableFiles(files: File[]) {
	const ok: File[] = []
	for (const file of files) {
		if (!/^image\/(png|jpe?g|webp|gif|avif)$/i.test(file.type)) {
			toast.error(`${file.name}: unsupported format.`)
			continue
		}
		if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
			toast.error(`${file.name} is larger than 2 MB.`)
			continue
		}
		ok.push(file)
	}
	return ok
}

async function uploadFiles(fileList: File[]) {
	const files = acceptableFiles(fileList)
	if (!files.length) {
		return
	}

	uploading.value = true
	try {
		// Sequential so the "first image becomes primary" rule stays race-free.
		for (const file of files) {
			const target = await $fetch<ProductImageUploadTarget>("/api/admin/product-images/presign", {
				method: "POST",
				body: { sourceKey: props.sourceKey, fileName: file.name, contentType: file.type, fileSize: file.size },
			})
			await $fetch(target.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } })
			await $fetch("/api/admin/product-images", {
				method: "POST",
				body: { sourceKey: props.sourceKey, objectKey: target.objectKey, contentType: file.type, fileSize: file.size },
			})
		}
		await refreshImages()
		toast.success(files.length > 1 ? `${files.length} images uploaded.` : "Image uploaded.")
	}
	catch (err) {
		const fetchError = err as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to upload image.")
	}
	finally {
		uploading.value = false
	}
}

async function onFilesSelected(event: Event) {
	const input = event.target as HTMLInputElement
	if (input.files?.length) {
		await uploadFiles(Array.from(input.files))
	}
	input.value = ""
}

function onDrop(event: DragEvent) {
	isDragging.value = false
	const files = event.dataTransfer?.files
	if (files?.length) {
		void uploadFiles(Array.from(files))
	}
}

async function setPrimary(image: ProductImage) {
	busyId.value = image.id
	try {
		await $fetch(`/api/admin/product-images/${image.id}`, { method: "PATCH", body: { isPrimary: true } })
		await refreshImages()
		toast.success("Primary image updated.")
	}
	catch (err) {
		const fetchError = err as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to update image.")
	}
	finally {
		busyId.value = null
	}
}

async function confirmDelete() {
	const image = pendingDelete.value
	if (!image) {
		return
	}
	busyId.value = image.id
	try {
		await $fetch(`/api/admin/product-images/${image.id}`, { method: "DELETE" })
		selected.value = 0
		await refreshImages()
		toast.success("Image removed.")
	}
	catch (err) {
		const fetchError = err as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to remove image.")
	}
	finally {
		busyId.value = null
		pendingDelete.value = null
	}
}
</script>

<template>
	<div class="space-y-3">
		<!-- Main image: click to open the zoomable viewer -->
		<div class="bg-muted relative aspect-square overflow-hidden rounded-lg border">
			<button
				v-if="selectedImage"
				type="button"
				class="group block size-full"
				aria-label="Open image viewer"
				@click="openLightbox(selected)"
			>
				<img
					:src="selectedImage.url"
					:alt="selectedImage.alt || productName"
					class="size-full object-contain"
				>

				<span class="bg-background/85 text-muted-foreground absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
					<ZoomIn class="size-3.5" />
					Click to zoom
				</span>
			</button>

			<div
				v-else
				class="text-muted-foreground flex size-full flex-col items-center justify-center gap-2"
			>
				<ImageIcon class="size-12" />

				<span class="text-xs">No image</span>
			</div>
		</div>

		<!-- Thumbnail strip -->
		<div
			v-if="images.length"
			class="flex gap-2 overflow-x-auto pb-1"
		>
			<div
				v-for="(img, i) in images"
				:key="img.id"
				class="group relative shrink-0"
			>
				<button
					type="button"
					class="block size-16 overflow-hidden rounded-md border transition-colors"
					:class="i === selected ? 'border-primary ring-primary/30 ring-2' : 'border-border hover:border-primary/50'"
					@click="selected = i"
					@dblclick="openLightbox(i)"
				>
					<img
						:src="img.url"
						:alt="img.alt || productName"
						class="size-full object-cover"
					>
				</button>

				<span
					v-if="img.isPrimary"
					class="bg-primary text-primary-foreground absolute -top-1.5 -left-1.5 flex size-4 items-center justify-center rounded-full"
					title="Primary image"
				>
					<Star class="size-2.5" />
				</span>

				<div
					v-if="isAdmin"
					class="absolute inset-x-0 -bottom-1 flex justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
				>
					<Button
						v-if="!img.isPrimary"
						type="button"
						size="icon-sm"
						variant="secondary"
						class="size-6"
						:disabled="busyId === img.id"
						title="Set as primary"
						@click="setPrimary(img)"
					>
						<Star class="size-3" />
					</Button>

					<Button
						type="button"
						size="icon-sm"
						variant="destructive"
						class="size-6"
						:disabled="busyId === img.id"
						title="Remove image"
						@click="pendingDelete = img"
					>
						<LoaderCircle
							v-if="busyId === img.id"
							class="size-3 animate-spin"
						/>

						<Trash2
							v-else
							class="size-3"
						/>
					</Button>
				</div>
			</div>
		</div>

		<!-- Admin: drag-and-drop upload zone -->
		<div v-if="isAdmin">
			<input
				ref="fileInput"
				type="file"
				:accept="ACCEPTED"
				multiple
				class="hidden"
				@change="onFilesSelected"
			>

			<button
				type="button"
				class="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center transition-colors"
				:class="isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'"
				:disabled="uploading"
				@click="fileInput?.click()"
				@dragover.prevent="isDragging = true"
				@dragleave.prevent="isDragging = false"
				@drop.prevent="onDrop"
			>
				<LoaderCircle
					v-if="uploading"
					class="text-muted-foreground size-5 animate-spin"
				/>

				<Upload
					v-else
					class="text-muted-foreground size-5"
				/>

				<span class="text-sm font-medium">
					{{ uploading ? "Uploading…" : "Drop images or click to upload" }}
				</span>

				<span class="text-muted-foreground text-xs">
					PNG, JPG, WebP, GIF or AVIF · up to 2 MB each
				</span>
			</button>
		</div>

		<ImageLightbox
			v-model:open="lightboxOpen"
			:images="images"
			:start-index="lightboxIndex"
		/>

		<AlertDialog
			:open="pendingDelete !== null"
			@update:open="(v: boolean) => { if (!v) pendingDelete = null }"
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Remove this image?</AlertDialogTitle>

					<AlertDialogDescription>
						This permanently deletes the image from {{ productName }}. This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel @click="pendingDelete = null">
						Cancel
					</AlertDialogCancel>

					<Button
						variant="destructive"
						:disabled="busyId !== null"
						@click="confirmDelete"
					>
						<LoaderCircle
							v-if="busyId !== null"
							class="size-4 animate-spin"
						/>
						Remove image
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	</div>
</template>
