import { sql } from "kysely"
import { Database } from "../base"

class CartRepository extends Database {
	private static cartInstance: CartRepository | null = null

	private constructor() {
		super(Database.getInstance().getQueryBuilder())
	}

	static override getInstance() {
		if (!CartRepository.cartInstance) {
			CartRepository.cartInstance = new CartRepository()
		}

		return CartRepository.cartInstance
	}

	async listItems(userId: number) {
		return this.db
			.selectFrom("cart_items")
			.where("user_id", "=", userId)
			.selectAll()
			.orderBy("created_at", "asc")
			.execute()
	}

	async upsertItem(userId: number, sourceKey: string, quantity: number) {
		return this.db
			.insertInto("cart_items")
			.values({
				user_id: userId,
				source_key: sourceKey,
				quantity,
			})
			.onConflict(oc => oc
				.columns(["user_id", "source_key"])
				.doUpdateSet({
					quantity: sql<number>`cart_items.quantity + excluded.quantity`,
				}))
			.returningAll()
			.executeTakeFirstOrThrow()
	}

	async updateQuantity(userId: number, itemId: number, quantity: number) {
		if (quantity <= 0) {
			return this.deleteItem(userId, itemId)
		}

		return this.db
			.updateTable("cart_items")
			.set({ quantity })
			.where("id", "=", itemId)
			.where("user_id", "=", userId)
			.returningAll()
			.executeTakeFirst()
	}

	async deleteItem(userId: number, itemId: number) {
		return this.db
			.deleteFrom("cart_items")
			.where("id", "=", itemId)
			.where("user_id", "=", userId)
			.returningAll()
			.executeTakeFirst()
	}
}

export const cartRepo = CartRepository.getInstance()
