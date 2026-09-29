import { tick } from "../lib/social/worker";
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});
console.log("NVO social delivery worker started.");
async function main() {
  while (!stopping) {
    try {
      await tick();
    } catch {
      console.error(
        "Social delivery cycle failed. Check database access and worker health.",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}
void main();
