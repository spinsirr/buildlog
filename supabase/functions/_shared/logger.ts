import { configure, getConsoleSink, getLogger, type Logger } from "jsr:@logtape/logtape@^0.11"

let configured = false

export async function setupLogger(): Promise<void> {
  if (configured) return
  try {
    await configure({
      sinks: {
        console: getConsoleSink(),
      },
      loggers: [
        { category: ["buildlog"], sinks: ["console"], lowestLevel: "debug" },
      ],
    })
    configured = true
  } catch (err) {
    // LogTape throws if configure() is called more than once (e.g. warm isolate reuse).
    // Mark as configured to avoid retry loops, but log unexpected errors.
    configured = true
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes("already configured")) {
      console.error("[logger] unexpected configure error:", msg)
    }
  }
}

export function getLog(name: string): Logger {
  return getLogger(["buildlog", name])
}
