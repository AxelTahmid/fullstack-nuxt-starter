export default defineNuxtRouteMiddleware(async (to) => {
	const { user, loggedIn, fetch: refreshSession } = useUserSession()
	await refreshSession()

	if (!loggedIn.value) {
		return await navigateTo({
			path: "/auth/login",
			query: { redirect: to.fullPath },
		})
	}

	if (user.value?.role !== "admin") {
		return await navigateTo("/dashboard")
	}
})
