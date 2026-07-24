type LogLevel = "info" | "warn" | "error";

function timestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const line = `[${timestamp()}] [${level.toUpperCase()}] ${message}`;
  const output = meta ? `${line} ${JSON.stringify(meta)}` : line;

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    // eslint-disable-next-line no-console -- info level intentionally uses console.log
    console.log(output);
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
};
