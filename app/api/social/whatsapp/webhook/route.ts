import { NextRequest } from "next/server";
import {
  processWhatsAppWebhook,
  verifyWhatsAppSignature,
} from "@/lib/social/whatsapp";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN &&
    p.get("hub.mode") === "subscribe" &&
    p.get("hub.verify_token") === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  )
    return new Response(p.get("hub.challenge") || "");
  return new Response(null, { status: 403 });
}
export async function POST(req: NextRequest) {
  if (Number(req.headers.get("content-length") || 0) > 1048576)
    return new Response(null, { status: 413 });
  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length > 1048576) return new Response(null, { status: 413 });
  if (
    !verifyWhatsAppSignature(
      bytes,
      req.headers.get("x-hub-signature-256") || "",
    )
  )
    return new Response(null, { status: 403 });
  try {
    processWhatsAppWebhook(JSON.parse(bytes.toString()));
    return Response.json({ ok: true });
  } catch {
    return new Response(null, { status: 500 });
  }
}
