import { pollLogin } from "../../../../lib/auth-flow.ts";

export const runtime = "nodejs";

export async function GET() {
  const result = await pollLogin();
  return Response.json(result, { status: result.status === "missing" ? 400 : 200 });
}
