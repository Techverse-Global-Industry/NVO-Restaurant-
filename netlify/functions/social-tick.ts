import { tick } from "../../lib/social/worker";

// Netlify invokes this independently of web traffic. The worker itself leases
// jobs transactionally, so overlapping warm invocations cannot publish twice.
export default async function socialTick() {
  try {
    await tick();
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("NVO social tick failed", error instanceof Error ? error.name : "Error");
    return new Response(null, { status: 500 });
  }
}
