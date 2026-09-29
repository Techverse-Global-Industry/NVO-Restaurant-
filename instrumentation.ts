export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.npm_lifecycle_event !== "build" &&
    !["off", "external"].includes(process.env.SOCIAL_WORKER_MODE || "embedded")
  ) {
    const { startWorker } = await import("./lib/social/worker");
    startWorker();
  }
}
