export default defineNuxtRouteMiddleware(async (to) => {
	const publicRoutes = ["/", "/auth/login", "/auth/verify"]
	const isPublicRoute = publicRoutes.includes(to.path)

	const { loggedIn, user, fetch: refreshSession } = useUserSession()
	await refreshSession()
	const passwordChangePath = "/auth/password"
	const passwordResetRequired = Boolean(user.value?.password_reset_required)

	if (loggedIn.value && passwordResetRequired && to.path !== passwordChangePath) {
		return await navigateTo({
			path: passwordChangePath,
			query: to.path === "/auth/login" ? to.query : { redirect: to.fullPath },
		})
	}

	if (loggedIn.value && !passwordResetRequired && to.path === passwordChangePath) {
		return await navigateTo("/dashboard")
	}

	if (loggedIn.value && (to.path === "/" || to.path === "/auth/login")) {
		return await navigateTo("/dashboard")
	}

	if (isPublicRoute) {
		return
	}

	if (!loggedIn.value) {
		return await navigateTo({
			path: "/auth/login",
			query: { redirect: to.fullPath },
		})
	}
})
