import type { Queue } from "pg-boss"
import { TIME } from "#shared/utils"
import { JOB_NAMES, type JobName } from "./workers"

export const queueConfigs: Record<JobName, Queue> = {
	[JOB_NAMES.SEND_AUTH_LINK_EMAIL]: {
		name: JOB_NAMES.SEND_AUTH_LINK_EMAIL,
		retryLimit: 3,
		retryDelay: 2 * TIME.MINUTE,
		retryBackoff: true,
		expireInSeconds: 1 * TIME.HOUR,
		deleteAfterSeconds: 3 * TIME.DAY,
	},
	[JOB_NAMES.SEND_USER_CREDENTIAL_EMAIL]: {
		name: JOB_NAMES.SEND_USER_CREDENTIAL_EMAIL,
		retryLimit: 3,
		retryDelay: 2 * TIME.MINUTE,
		retryBackoff: true,
		expireInSeconds: 1 * TIME.HOUR,
		deleteAfterSeconds: 3 * TIME.DAY,
	},
	[JOB_NAMES.SEND_ENQUIRY_MESSAGE_NOTIFICATION]: {
		name: JOB_NAMES.SEND_ENQUIRY_MESSAGE_NOTIFICATION,
		retryLimit: 3,
		retryDelay: 1 * TIME.MINUTE,
		retryBackoff: true,
		expireInSeconds: 1 * TIME.HOUR,
		deleteAfterSeconds: 3 * TIME.DAY,
	},
}
