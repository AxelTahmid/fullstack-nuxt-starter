<script setup lang="ts">
import { ImageIcon, LoaderCircle, Star, Trash2, Upload } from "@lucide/vue"
import type { FetchError } from "ofetch"
import type { ProductImage, ProductImageUploadTarget } from "#shared/types/product"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { toast } from "~/components/toast"

const props = defineProps<{
	sourceKey: string
	productName: string
	isAdmin: boolean
	initialImages: ProductImage[]
}>()

const images = ref<ProductImage[]>([...props.initialImages])
watch(() => props.initialImages, value => (images.value = [...value]))

const selected = ref(0)
const selectedImage = computed(() => images.value[selected.value] ?? images.value[0] ?? null)

const fileInput = useTemplateRef<HTMLInputElement>("fileInput")
const uploading = ref(false)
const busyId = ref<number | null>(null)

async function refreshAdminImages() {
	images.value = await $fetch<ProductImage[]>("/api/admin/product-images", {
		query: { sourceKey: props.sourceKey },
	})
	if (selected.value >= images.value.length) {
		selected.value = 0
	}
}

async function onFilesSelected(event: Event) {
	const input = event.target as HTMLInputElement
	const files = input.files
	if (!files || files.length === 0) {
		return
	}

	uploading.value = true
	try {
		// Sequential so the "first image becomes primary" rule stays race-free.
		for (let i = 0; i < files.length; i++) {
			const file = files[i]!
			const target = await $fetch<ProductImageUploadTarget>("/api/admin/product-images/presign", {
				method: "POST",
				body: { sourceKey: props.sourceKey, fileName: file.name, contentType: file.type },
			})
			await $fetch(target.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } })
			await $fetch("/api/admin/product-images", {
				method: "POST",
				body: { sourceKey: props.sourceKey, objectKey: target.objectKey, contentType: file.type, fileSize: file.size },
			})
		}
		await refreshAdminImages()
		toast.success(files.length > 1 ? `${files.length} images uploaded.` : "Image uploaded.")
	}
	catch (err) {
		const fetchError = err as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to upload image.")
	}
	finally {
		uploading.value = false
		input.value = ""
	}
}

async function setPrimary(image: ProductImage) {
	busyId.value = image.id
	try {
		await $fetch(`/api/admin/product-images/${image.id}`, { method: "PATCH", body: { isPrimary: true } })
		await refreshAdminImages()
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

async function removeImage(image: ProductImage) {
	busyId.value = image.id
	try {
		await $fetch(`/api/admin/product-images/${image.id}`, { method: "DELETE" })
		selected.value = 0
		await refreshAdminImages()
		toast.success("Image removed.")
	}
	catch (err) {
		const fetchError = err as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to remove image.")
	}
	finally {
		busyId.value = null
	}
}
</script>

<template>
	<Card class="overflow-hidden py-0">
		<div class="bg-muted aspect-square">
			<img
				v-if="selectedImage"
				:src="selectedImage.url"
				:alt="selectedImage.alt || productName"
				class="size-full object-contain"
			>

			<div
				v-else
				class="text-muted-foreground flex size-full items-center justify-center"
			>
				<ImageIcon class="size-12" />
			</div>
		</div>

		<div
			v-if="images.length || isAdmin"
			class="border-border/60 space-y-3 border-t p-3"
		>
			<div
				v-if="images.length"
				class="flex flex-wrap gap-2"
			>
				<div
					v-for="(img, i) in images"
					:key="img.id"
					class="group relative"
				>
					<button
						type="button"
						class="block size-14 overflow-hidden rounded-md border transition-colors"
						:class="i === selected ? 'border-primary ring-primary/30 ring-2' : 'border-border hover:border-primary/50'"
						@click="selected = i"
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
							@click="removeImage(img)"
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

			<div v-if="isAdmin">
				<input
					ref="fileInput"
					type="file"
					accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
					multiple
					class="hidden"
					@change="onFilesSelected"
				>

				<Button
					type="button"
					variant="outline"
					size="sm"
					:disabled="uploading"
					@click="fileInput?.click()"
				>
					<LoaderCircle
						v-if="uploading"
						class="size-4 animate-spin"
					/>

					<Upload
						v-else
						class="size-4"
					/>
					{{ uploading ? "Uploading…" : "Upload image" }}
				</Button>
			</div>
		</div>
	</Card>
</template>
