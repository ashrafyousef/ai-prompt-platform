type LogLevel = "info" | "warn" | "error";

export function logJson(level: LogLevel, payload: Record<string, unknown>) {
  const body = {
    timestamp: new Date().toISOString(),
    level,
    ...payload,
  };
  const line = JSON.stringify(body);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
