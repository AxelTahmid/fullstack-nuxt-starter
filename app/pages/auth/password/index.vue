<script setup lang="ts">
import { KeyRound, LoaderCircle } from "@lucide/vue"
import type { FetchError } from "ofetch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import defaultLogo from "~/assets/supplykey_logo.png"
import { toast } from "~/components/toast"
import { useBrand } from "~/composables/useBrand"

definePageMeta({
	layout: "empty",
	middleware: ["authenticated"],
})

useHead({
	title: "Change Password",
})

const route = useRoute()
const { fetch: refreshSession } = useUserSession()
const { brand, refresh: refreshBrand } = useBrand()
if (!brand.value)
	await refreshBrand()

const logoSrc = computed(() => brand.value?.logoDataUrl || defaultLogo)
const orgTagline = computed(() => brand.value?.tagline ?? "Mine Supply Company")
const redirectTarget = computed(() => {
	const value = route.query.redirect
	return typeof value === "string" && value.startsWith("/") && value !== "/auth/password"
		? value
		: "/dashboard"
})

const currentPassword = ref("")
const newPassword = ref("")
const confirmPassword = ref("")
const isSubmitting = ref(false)

async function changePassword() {
	if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
		toast.error("All password fields are required.")
		return
	}

	isSubmitting.value = true
	try {
		await $fetch("/api/auth/password/change", {
			method: "POST",
			body: {
				currentPassword: currentPassword.value,
				newPassword: newPassword.value,
				confirmPassword: confirmPassword.value,
			},
		})
		await refreshSession()
		toast.success("Password updated.")
		await navigateTo(redirectTarget.value)
	}
	catch (error) {
		const fetchError = error as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to update password.")
	}
	finally {
		isSubmitting.value = false
	}
}
</script>

<template>
	<div class="bg-background relative flex min-h-screen flex-col overflow-hidden">
		<main class="relative flex grow items-center justify-center p-6">
			<div class="w-full max-w-md">
				<div class="mb-10 flex flex-col items-center justify-center text-center">
					<img
						:src="logoSrc"
						alt="Brand logo"
						class="mx-auto mb-5 h-20 w-auto"
					>

					<p class="text-muted-foreground text-[0.6875rem] font-semibold tracking-[0.28em] uppercase">
						{{ orgTagline }}
					</p>
				</div>

				<div class="border-border/40 bg-card rounded-[0.5rem] border p-10">
					<form
						class="space-y-8"
						@submit.prevent="changePassword"
					>
						<div class="space-y-2">
							<div class="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-md">
								<KeyRound class="size-5" />
							</div>

							<h1
								class="text-foreground text-xl font-bold tracking-tight"
								style="font-family: var(--font-display);"
							>
								Change Password
							</h1>

							<p class="text-muted-foreground text-sm">
								Set a new password before continuing.
							</p>
						</div>

						<div class="space-y-2">
							<Label
								for="current-password"
								class="text-muted-foreground text-[0.6875rem] font-bold tracking-[0.16em] uppercase"
							>
								Current Password
							</Label>

							<Input
								id="current-password"
								v-model="currentPassword"
								type="password"
								autocomplete="current-password"
								:disabled="isSubmitting"
								class="border-border/60 bg-muted text-foreground placeholder:text-muted-foreground/60 focus:border-primary w-full border-0 border-b-2 px-3 py-3 text-sm transition-all placeholder:font-light focus:outline-none disabled:opacity-60"
							/>
						</div>

						<div class="space-y-2">
							<Label
								for="new-password"
								class="text-muted-foreground text-[0.6875rem] font-bold tracking-[0.16em] uppercase"
							>
								New Password
							</Label>

							<Input
								id="new-password"
								v-model="newPassword"
								type="password"
								autocomplete="new-password"
								:disabled="isSubmitting"
								class="border-border/60 bg-muted text-foreground placeholder:text-muted-foreground/60 focus:border-primary w-full border-0 border-b-2 px-3 py-3 text-sm transition-all placeholder:font-light focus:outline-none disabled:opacity-60"
							/>
						</div>

						<div class="space-y-2">
							<Label
								for="confirm-password"
								class="text-muted-foreground text-[0.6875rem] font-bold tracking-[0.16em] uppercase"
							>
								Confirm Password
							</Label>

							<Input
								id="confirm-password"
								v-model="confirmPassword"
								type="password"
								autocomplete="new-password"
								:disabled="isSubmitting"
								class="border-border/60 bg-muted text-foreground placeholder:text-muted-foreground/60 focus:border-primary w-full border-0 border-b-2 px-3 py-3 text-sm transition-all placeholder:font-light focus:outline-none disabled:opacity-60"
							/>
						</div>

						<Button
							type="submit"
							class="bg-primary text-primary-foreground flex w-full items-center justify-center rounded-[0.375rem] px-4 py-4 text-sm font-extrabold tracking-[0.15em] uppercase transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
							:disabled="isSubmitting"
							style="font-family: var(--font-display);"
						>
							<LoaderCircle
								v-if="isSubmitting"
								class="mr-2 size-4 animate-spin"
							/>

							<span>{{ isSubmitting ? "Updating..." : "Update Password" }}</span>
						</Button>
					</form>
				</div>
			</div>
		</main>
	</div>
</template>
