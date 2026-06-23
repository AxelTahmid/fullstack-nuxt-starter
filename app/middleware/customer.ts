export default defineNuxtRouteMiddleware(async (to) => {
	const { user, loggedIn, fetch: refreshSession } = useUserSession()
	await refreshSession()

	if (!loggedIn.value) {
		return await navigateTo({
			path: "/auth/login",
			query: { redirect: to.fullPath },
		})
	}

	// Cart, checkout, and estimate requests are customer actions; admins triage
	// and fulfil rather than shop.
	if (user.value?.role !== "customer") {
		return await navigateTo("/dashboard")
	}
})
