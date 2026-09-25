import { loadTokens } from "../../../../lib/chatgpt.ts";

export const runtime = "nodejs";

export async function GET() {
  const tokens = await loadTokens();
  return Response.json({ authenticated: Boolean(tokens), accountId: tokens?.accountId });
}
