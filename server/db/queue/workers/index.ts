import type { SendAuthLinkEmailJobData } from "./send-auth-link-email"
import type { SendUserCredentialEmailJobData } from "./send-user-credential-email"

export { createSendAuthLinkEmailHandler } from "./send-auth-link-email"
export { createSendUserCredentialEmailHandler } from "./send-user-credential-email"
export type { SendAuthLinkEmailJobData, SendUserCredentialEmailJobData }

export const JOB_NAMES = {
	SEND_AUTH_LINK_EMAIL: "send-auth-link-email",
	SEND_USER_CREDENTIAL_EMAIL: "send-user-credential-email",
} as const

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES]

export interface JobTypeMap {
	[JOB_NAMES.SEND_AUTH_LINK_EMAIL]: SendAuthLinkEmailJobData
	[JOB_NAMES.SEND_USER_CREDENTIAL_EMAIL]: SendUserCredentialEmailJobData
}
