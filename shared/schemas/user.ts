import { z } from "zod"

export const userRoleSchema = z.enum(["admin", "customer"])

export const createUserSchema = z.object({
	email: z.string().trim().email("Valid email is required"),
	name: z.string().trim().max(160).optional(),
	role: userRoleSchema.default("customer"),
	sageCustomerNumber: z.string().trim().max(60).nullable().optional(),
	sageCustomerName: z.string().trim().max(200).nullable().optional(),
})

export const updateUserSchema = z.object({
	email: z.string().trim().email("Valid email is required").optional(),
	name: z.string().trim().max(160).nullable().optional(),
	role: userRoleSchema.optional(),
	sageCustomerNumber: z.string().trim().max(60).nullable().optional(),
	sageCustomerName: z.string().trim().max(200).nullable().optional(),
	deactivated: z.boolean().optional(),
})

export const changePasswordSchema = z.object({
	currentPassword: z.string().min(1, "Current password is required"),
	newPassword: z.string()
		.min(12, "Password must be at least 12 characters")
		.regex(/[a-z]/, "Password must include a lowercase letter")
		.regex(/[A-Z]/, "Password must include an uppercase letter")
		.regex(/\d/, "Password must include a number"),
	confirmPassword: z.string().min(1, "Confirm your new password"),
}).refine(value => value.newPassword === value.confirmPassword, {
	message: "Passwords do not match",
	path: ["confirmPassword"],
}).refine(value => value.currentPassword !== value.newPassword, {
	message: "New password must be different from the current password",
	path: ["newPassword"],
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
