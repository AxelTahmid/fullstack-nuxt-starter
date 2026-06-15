import type { Logger, LoggerOptions } from "pino"
import pino from "pino"

const development: LoggerOptions = {
	name: "starter",
	level: "trace",
	transport: {
		target: "pino-pretty",
		options: {
			colorize: true,
		},
	},
	browser: {
		asObject: true,
		disabled: false,
	},
}

const production: LoggerOptions = {
	name: "starter",
	level: "info",
	browser: {
		disabled: true,
	},
}

export const log: Logger = pino(
	process.env.NODE_ENV === "production" ? production : development,
)

// /* eslint-disable no-unused-vars,no-console */
// type LogMethod = (objOrMsg?: unknown, maybeMsg?: string) => void

// type AppLogger = {
// 	trace: LogMethod
// 	debug: LogMethod
// 	info: LogMethod
// 	warn: LogMethod
// 	error: LogMethod
// 	fatal: LogMethod
// }

// const env = process.env.NODE_ENV || "development"
// const isProd = env === "production"
// const isStaging = env === "staging"

// function write(level: "trace" | "debug" | "info" | "warn" | "error" | "fatal", objOrMsg?: unknown, maybeMsg?: string) {
// 	if ((level === "trace" || level === "debug") && isProd && !isStaging) {
// 		return
// 	}

// 	if (typeof objOrMsg === "string") {
// 		getConsoleMethod(level)(objOrMsg)
// 		return
// 	}

// 	const message = maybeMsg || `[${level}]`
// 	if (objOrMsg !== undefined) {
// 		getConsoleMethod(level)(message, objOrMsg)
// 		return
// 	}

// 	getConsoleMethod(level)(message)
// }

// function getConsoleMethod(level: "trace" | "debug" | "info" | "warn" | "error" | "fatal") {
// 	if (level === "fatal") {
// 		return console.error
// 	}
// 	return console[level]
// }

// export const log: AppLogger = {
// 	trace: (objOrMsg, maybeMsg) => write("trace", objOrMsg, maybeMsg),
// 	debug: (objOrMsg, maybeMsg) => write("debug", objOrMsg, maybeMsg),
// 	info: (objOrMsg, maybeMsg) => write("info", objOrMsg, maybeMsg),
// 	warn: (objOrMsg, maybeMsg) => write("warn", objOrMsg, maybeMsg),
// 	error: (objOrMsg, maybeMsg) => write("error", objOrMsg, maybeMsg),
// 	fatal: (objOrMsg, maybeMsg) => write("fatal", objOrMsg, maybeMsg),
// }
