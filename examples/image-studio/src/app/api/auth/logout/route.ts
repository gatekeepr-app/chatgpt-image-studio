import { clearTokens } from "../../../../lib/chatgpt.ts";

export const runtime = "nodejs";

export async function POST() {
  await clearTokens();
  return Response.json({ ok: true });
}
