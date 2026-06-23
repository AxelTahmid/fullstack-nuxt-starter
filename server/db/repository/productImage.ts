import type { Updateable } from "kysely"
import type { ProductImages } from "../types"
import { Database } from "../base"

interface CreateProductImageInput {
	sourceKey: string
	objectKey: string
	contentType: string | null
	alt: string | null
	fileSize: number | null
	createdBy: number | null
}

class ProductImageRepository extends Database {
	private static productImageInstance: ProductImageRepository | null = null

	private constructor() {
		super(Database.getInstance().getQueryBuilder())
	}

	static override getInstance() {
		if (!ProductImageRepository.productImageInstance) {
			ProductImageRepository.productImageInstance = new ProductImageRepository()
		}

		return ProductImageRepository.productImageInstance
	}

	/** All images for a product, primary first, then by sort order. */
	async listBySourceKey(sourceKey: string) {
		return this.db
			.selectFrom("product_images")
			.selectAll()
			.where("source_key", "=", sourceKey)
			.orderBy("is_primary", "desc")
			.orderBy("sort_order", "asc")
			.orderBy("id", "asc")
			.execute()
	}

	/** One image per source key (primary, else earliest) — for catalog list thumbnails. */
	async listPrimaryBySourceKeys(sourceKeys: string[]) {
		if (sourceKeys.length === 0) {
			return []
		}

		return this.db
			.selectFrom("product_images")
			.select(["source_key", "object_key"])
			.where("source_key", "in", sourceKeys)
			.distinctOn("source_key")
			.orderBy("source_key")
			.orderBy("is_primary", "desc")
			.orderBy("sort_order", "asc")
			.orderBy("id", "asc")
			.execute()
	}

	async findById(id: number) {
		return this.db
			.selectFrom("product_images")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst()
	}

	async create(input: CreateProductImageInput) {
		return this.db.transaction().execute(async (trx) => {
			const existing = await trx
				.selectFrom("product_images")
				.select(eb => eb.fn.max<number | null>("sort_order").as("maxSort"))
				.where("source_key", "=", input.sourceKey)
				.executeTakeFirst()

			const isFirst = existing?.maxSort == null

			return trx
				.insertInto("product_images")
				.values({
					source_key: input.sourceKey,
					object_key: input.objectKey,
					content_type: input.contentType,
					alt: input.alt,
					file_size: input.fileSize,
					is_primary: isFirst,
					sort_order: (existing?.maxSort ?? -1) + 1,
					created_by: input.createdBy,
				})
				.returningAll()
				.executeTakeFirstOrThrow()
		})
	}

	/** Make one image primary and clear the flag on its siblings. */
	async setPrimary(id: number) {
		return this.db.transaction().execute(async (trx) => {
			const image = await trx
				.selectFrom("product_images")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirst()
			if (!image) {
				return undefined
			}

			await trx
				.updateTable("product_images")
				.set({ is_primary: false })
				.where("source_key", "=", image.source_key)
				.where("is_primary", "=", true)
				.execute()

			await trx
				.updateTable("product_images")
				.set({ is_primary: true })
				.where("id", "=", id)
				.execute()

			return { ...image, is_primary: true }
		})
	}

	async updateMeta(id: number, patch: { alt?: string | null, sortOrder?: number }) {
		const set: Updateable<ProductImages> = {}
		if (patch.alt !== undefined) {
			set.alt = patch.alt
		}
		if (patch.sortOrder !== undefined) {
			set.sort_order = patch.sortOrder
		}
		if (Object.keys(set).length === 0) {
			return this.findById(id)
		}

		return this.db
			.updateTable("product_images")
			.set(set)
			.where("id", "=", id)
			.returningAll()
			.executeTakeFirst()
	}

	/** Delete a row; if it was the primary, promote the next image. Returns the row. */
	async delete(id: number) {
		return this.db.transaction().execute(async (trx) => {
			const image = await trx
				.selectFrom("product_images")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirst()
			if (!image) {
				return undefined
			}

			await trx.deleteFrom("product_images").where("id", "=", id).execute()

			if (image.is_primary) {
				const next = await trx
					.selectFrom("product_images")
					.select("id")
					.where("source_key", "=", image.source_key)
					.orderBy("sort_order", "asc")
					.orderBy("id", "asc")
					.executeTakeFirst()
				if (next) {
					await trx
						.updateTable("product_images")
						.set({ is_primary: true })
						.where("id", "=", next.id)
						.execute()
				}
			}

			return image
		})
	}
}

export const productImageRepo = ProductImageRepository.getInstance()
