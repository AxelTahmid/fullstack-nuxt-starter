import type { PgBoss, SendOptions } from "pg-boss"
import { log } from "#shared/log"
import { queueConfigs } from "./config"
import {
	createSendAuthLinkEmailHandler,
	createSendUserCredentialEmailHandler,
	JOB_NAMES,
	type JobName,
	type JobTypeMap,
} from "./workers"

export class Queue {
	constructor(private boss: PgBoss) {}

	async setupQueues() {
		await this.createRequiredQueues()
		await this.boss.work(JOB_NAMES.SEND_AUTH_LINK_EMAIL, createSendAuthLinkEmailHandler())
		log.info(`✓ Worker registered: ${JOB_NAMES.SEND_AUTH_LINK_EMAIL}`)
		await this.boss.work(JOB_NAMES.SEND_USER_CREDENTIAL_EMAIL, createSendUserCredentialEmailHandler())
		log.info(`✓ Worker registered: ${JOB_NAMES.SEND_USER_CREDENTIAL_EMAIL}`)
	}

	private async createRequiredQueues() {
		const queueNames = Object.values(JOB_NAMES)

		await Promise.all(
			queueNames.map(async (queueName) => {
				const config = queueConfigs[queueName]
				await this.boss.createQueue(queueName, {
					retryLimit: config.retryLimit,
					retryDelay: config.retryDelay,
					retryBackoff: config.retryBackoff,
					expireInSeconds: config.expireInSeconds,
					deleteAfterSeconds: config.deleteAfterSeconds,
				})
			}),
		)
	}

	async publishJob<T extends JobName>(jobName: T, data: JobTypeMap[T], options?: SendOptions) {
		const config = queueConfigs[jobName]
		return this.boss.send(jobName, data, { ...config, ...options })
	}

	async sendAuthLinkEmail(email: string, magicLink: string, appName: string, expiresInMinutes: number) {
		return this.publishJob(JOB_NAMES.SEND_AUTH_LINK_EMAIL, {
			email,
			magicLink,
			appName,
			expiresInMinutes,
		})
	}

	async sendUserCredentialEmail(data: JobTypeMap[typeof JOB_NAMES.SEND_USER_CREDENTIAL_EMAIL]) {
		return this.publishJob(JOB_NAMES.SEND_USER_CREDENTIAL_EMAIL, data)
	}

	async getQueueSize(name: JobName) {
		const queue = await this.boss.getQueue(name)
		if (!queue) {
			return 0
		}

		return queue.queuedCount + queue.activeCount + queue.deferredCount
	}
}
