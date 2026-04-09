type CaptureContext = {
  route?: string;
  userId?: string;
};

export function captureError(error: unknown, context: CaptureContext = {}) {
  const payload = {
    route: context.route ?? "unknown",
    userId: context.userId ?? "unknown",
    error:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { message: String(error) },
  };
  console.error(JSON.stringify({ level: "error", source: "sentry-fallback", ...payload }));
}
