import { configure, getLogger, getLevelFilter, type LogRecord } from "@logtape/logtape";

let configured = false;

export async function configureLogging() {
  if (configured) return;
  configured = true;

  const minLevel = process.env.NODE_ENV === "production" ? "info" : "debug";

  await configure({
    sinks: {
      console: (record: LogRecord) => {
        const level = record.level.toUpperCase().padEnd(5);
        const category = record.category.join(".");
        const msg = record.message.map(String).join("");
        const ts = new Date(record.timestamp).toISOString().slice(11, 23);
        // eslint-disable-next-line no-console
        console.log(`[${ts}] ${level} [${category}] ${msg}`);
      },
    },
    filters: {
      level: getLevelFilter(minLevel),
    },
    loggers: [
      {
        category: ["buildlog"],
        sinks: ["console"],
        filters: ["level"],
      },
    ],
  });
}

// Call once at module load in dev; in Edge runtime (proxy.ts) call manually
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  configureLogging().catch(() => {});
}

export const logger = {
  proxy: getLogger(["buildlog", "proxy"]),
  auth: getLogger(["buildlog", "auth"]),
  webhook: getLogger(["buildlog", "webhook"]),
  ai: getLogger(["buildlog", "ai"]),
  posts: getLogger(["buildlog", "posts"]),
};
