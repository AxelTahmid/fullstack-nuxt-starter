import { z } from "zod"

export const listQuerySchema = z.object({
	page: z.coerce.number().int().min(1).catch(1),
	pageSize: z.coerce.number().int().min(1).max(50).catch(25),
	search: z.string().trim().max(100).optional(),
})

export type ListQueryInput = z.infer<typeof listQuerySchema>
