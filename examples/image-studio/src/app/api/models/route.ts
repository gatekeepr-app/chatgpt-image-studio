import { models } from "../../../lib/chatgpt.ts";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json({ models: await models() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load models." }, { status: 401 });
  }
}
