<script setup lang="ts">
import { LoaderCircle, LogIn, Zap } from "@lucide/vue"
import type { FetchError } from "ofetch"
import defaultLogo from "~/assets/supplykey_logo.png"
import { toast } from "~/components/toast"
import { useBrand } from "~/composables/useBrand"

definePageMeta({
	layout: "empty",
	middleware: ["authenticated"],
})

useHead({
	title: "Sign In",
})

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const demoMode = computed(() => runtimeConfig.public.demoMode)

const { brand, refresh: refreshBrand } = useBrand()
if (!brand.value)
	await refreshBrand()
const logoSrc = computed(() => brand.value?.logoDataUrl || defaultLogo)
const orgTagline = computed(() => brand.value?.tagline ?? "Mine Supply Company")

const email = ref("")
const password = ref("")
const isLoading = ref(false)
const isPasswordLoading = ref(false)
const isDemoLoading = ref(false)
const success = ref(false)
const redirectTarget = computed(() => {
	const value = route.query.redirect
	return typeof value === "string" && value.startsWith("/") ? value : undefined
})

async function handleMagicLink() {
	if (!email.value.trim()) {
		toast.error("Corporate email is required.")
		return
	}

	isLoading.value = true

	try {
		const response = await $fetch<{
			success: boolean
		}>("/api/auth/link", {
			method: "POST",
			body: {
				email: email.value,
				redirect: redirectTarget.value,
			},
		})

		success.value = response.success
		toast.success("Authentication link dispatched.")
	}
	catch (error) {
		const fetchError = error as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to dispatch authentication link.")
	}
	finally {
		isLoading.value = false
	}
}

async function handlePasswordLogin() {
	if (!email.value.trim()) {
		toast.error("Email is required.")
		return
	}
	if (!password.value) {
		toast.error("Password is required.")
		return
	}

	isPasswordLoading.value = true
	try {
		const response = await $fetch<{
			user: {
				passwordResetRequired: boolean
			}
		}>("/api/auth/password", {
			method: "POST",
			body: {
				email: email.value,
				password: password.value,
			},
		})
		toast.success("Signed in.")
		await navigateTo(response.user.passwordResetRequired
			? {
					path: "/auth/password",
					query: redirectTarget.value ? { redirect: redirectTarget.value } : undefined,
				}
			: redirectTarget.value || "/dashboard")
	}
	catch (error) {
		const fetchError = error as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to sign in.")
	}
	finally {
		isPasswordLoading.value = false
	}
}

async function handleDemoLogin() {
	isDemoLoading.value = true
	try {
		await $fetch("/api/auth/demo-login", { method: "POST" })
		toast.success("Demo session established.")
		await navigateTo(redirectTarget.value || "/dashboard")
	}
	catch (error) {
		const fetchError = error as FetchError<{ message?: string }>
		toast.error(fetchError.data?.message || "Unable to establish demo session.")
	}
	finally {
		isDemoLoading.value = false
	}
}

function resetState() {
	success.value = false
}
</script>

<template>
	<div class="bg-background relative flex min-h-screen flex-col overflow-hidden">
		<div
			aria-hidden="true"
			class="pointer-events-none absolute inset-0 opacity-[0.12]"
			style="background-image: radial-gradient(circle at 20% 20%, rgba(0, 63, 99, 0.35), transparent 50%), radial-gradient(circle at 80% 10%, rgba(80, 96, 112, 0.25), transparent 50%), linear-gradient(180deg, rgba(0, 20, 35, 0.08), transparent 60%);"
		/>

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

				<div class="border-border/40 bg-card relative rounded-[0.5rem] border p-10">
					<div
						v-if="success"
						class="space-y-6"
					>
						<div class="bg-muted rounded-[0.5rem] p-5">
							<p
								class="text-muted-foreground text-xs font-bold tracking-[0.18em] uppercase"
								style="font-family: var(--font-display);"
							>
								Authentication dispatched
							</p>

							<p class="text-foreground mt-3 text-sm">
								A sign-in link was generated for <span class="font-semibold">{{ email }}</span>.
							</p>

							<p class="text-muted-foreground mt-2 text-xs">
								Check Mailpit for the sign-in email.
							</p>

							<Button
								type="button"
								class="border-border text-foreground hover:bg-background mt-5 inline-flex items-center justify-center rounded-[0.375rem] border px-4 py-2 text-xs font-bold tracking-[0.15em] uppercase transition-all"
								@click="resetState"
							>
								Send another
							</Button>
						</div>
					</div>

					<form
						v-else
						class="space-y-8"
						@submit.prevent="handlePasswordLogin"
					>
						<div class="mb-2">
							<h2
								class="text-foreground text-xl font-bold tracking-tight"
								style="font-family: var(--font-display);"
							>
								Access Control
							</h2>

							<p class="text-muted-foreground mt-1 text-sm">
								Authenticated personnel only.
							</p>
						</div>

						<div class="space-y-2">
							<Label
								for="email"
								class="text-muted-foreground text-[0.6875rem] font-bold tracking-[0.16em] uppercase"
							>
								Corporate Email
							</Label>

							<div class="relative">
								<Input
									id="email"
									v-model="email"
									type="email"
									placeholder="name@supplykey.com"
									autocomplete="email"
									:disabled="isLoading"
									class="border-border/60 bg-muted text-foreground placeholder:text-muted-foreground/60 focus:border-primary w-full border-0 border-b-2 px-3 py-3 text-sm transition-all placeholder:font-light focus:outline-none disabled:opacity-60"
								/>
							</div>
						</div>

						<div class="space-y-2">
							<Label
								for="password"
								class="text-muted-foreground text-[0.6875rem] font-bold tracking-[0.16em] uppercase"
							>
								Password
							</Label>

							<Input
								id="password"
								v-model="password"
								type="password"
								placeholder="Temporary password"
								autocomplete="current-password"
								:disabled="isPasswordLoading"
								class="border-border/60 bg-muted text-foreground placeholder:text-muted-foreground/60 focus:border-primary w-full border-0 border-b-2 px-3 py-3 text-sm transition-all placeholder:font-light focus:outline-none disabled:opacity-60"
							/>
						</div>

						<div>
							<Button
								type="submit"
								class="group bg-primary text-primary-foreground flex w-full items-center justify-center rounded-[0.375rem] px-4 py-4 text-sm font-extrabold tracking-[0.15em] uppercase transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
								:disabled="isPasswordLoading"
								style="font-family: var(--font-display);"
							>
								<LoaderCircle
									v-if="isPasswordLoading"
									class="mr-2 size-4 animate-spin"
								/>

								<LogIn
									v-else
									class="mr-2 size-4 transition-transform group-hover:translate-x-0.5"
								/>

								<span>{{ isPasswordLoading ? "Signing in..." : "Sign In" }}</span>
							</Button>

							<Button
								type="button"
								variant="ghost"
								class="text-muted-foreground hover:text-foreground mt-3 w-full rounded-[0.375rem] text-xs font-bold tracking-[0.12em] uppercase"
								:disabled="isLoading || isPasswordLoading"
								@click="handleMagicLink"
							>
								<LoaderCircle
									v-if="isLoading"
									class="mr-2 size-4 animate-spin"
								/>
								{{ isLoading ? "Sending link..." : "Send magic link instead" }}
							</Button>
						</div>
					</form>

					<div
						v-if="demoMode && !success"
						class="border-border/40 mt-8 border-t pt-8"
					>
						<p class="text-muted-foreground mb-4 text-center text-[0.6875rem] font-bold tracking-[0.16em] uppercase">
							Conference Demo Mode
						</p>

						<Button
							type="button"
							class="group border-primary/30 bg-background text-primary hover:border-primary hover:bg-primary hover:text-primary-foreground flex w-full items-center justify-center rounded-[0.375rem] border-2 px-4 py-3 text-sm font-extrabold tracking-[0.15em] uppercase transition-all disabled:opacity-60"
							:disabled="isDemoLoading"
							style="font-family: var(--font-display);"
							@click="handleDemoLogin"
						>
							<LoaderCircle
								v-if="isDemoLoading"
								class="mr-2 size-4 animate-spin"
							/>

							<Zap
								v-else
								class="mr-2 size-4"
							/>

							<span>{{ isDemoLoading ? "Connecting..." : "Demo Sign In" }}</span>
						</Button>
					</div>

					<div class="border-border/40 mt-10 border-t pt-8 text-center">
						<p class="text-muted-foreground text-[0.6875rem] leading-relaxed tracking-[0.18em] uppercase">
							Issues with login? <br>

							Contact <span class="text-foreground font-bold">Systems Security</span>
						</p>
					</div>
				</div>

				<p class="text-muted-foreground/60 mt-8 text-center text-[0.625rem] font-medium tracking-[0.25em] uppercase">
					Unauthorized access is strictly monitored and recorded.
				</p>
			</div>
		</main>

		<footer class="border-border/20 bg-muted/40 relative w-full border-t py-6">
			<div class="flex flex-col items-center justify-between gap-3 px-6 md:flex-row md:px-12">
				<div class="flex items-center gap-2 leading-none">
					<span class="text-muted-foreground text-[0.625rem] leading-none font-semibold tracking-[0.2em] uppercase">
						Powered by
					</span>

					<img
						:src="defaultLogo"
						alt="SupplyKey"
						class="block h-3.5 w-auto"
					>
				</div>

				<div class="flex flex-wrap justify-center gap-6">
					<a
						href="#"
						class="text-muted-foreground hover:text-primary text-[0.625rem] font-semibold tracking-[0.2em] uppercase transition-colors"
					>Privacy Policy</a>

					<a
						href="#"
						class="text-muted-foreground hover:text-primary text-[0.625rem] font-semibold tracking-[0.2em] uppercase transition-colors"
					>Terms of Service</a>

					<a
						href="#"
						class="text-muted-foreground hover:text-primary text-[0.625rem] font-semibold tracking-[0.2em] uppercase transition-colors"
					>Compliance</a>

					<a
						href="#"
						class="text-muted-foreground hover:text-primary text-[0.625rem] font-semibold tracking-[0.2em] uppercase transition-colors"
					>Mining Standards</a>
				</div>
			</div>
		</footer>
	</div>
</template>
