import { startLogin } from "../../../../lib/auth-flow.ts";

export const runtime = "nodejs";

export async function POST() {
  const device = await startLogin();
  return Response.json({
    verificationUrl: device.verificationUrl,
    userCode: device.userCode,
    expiresAt: device.expiresAt,
  });
}
