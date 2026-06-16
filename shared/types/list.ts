export interface PaginatedList<T> {
	rows: T[]
	/** Total matching rows from Sage `$count`, or `null` when the count is unavailable. */
	total: number | null
	page: number
	pageSize: number
}
