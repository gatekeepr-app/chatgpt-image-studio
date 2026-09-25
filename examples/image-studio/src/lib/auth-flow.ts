import {
  exchangeDeviceAuthorization,
  pollDeviceCode,
  requestDeviceCode,
} from "../../../../packages/core/src/device.ts";
import { resolveConfig } from "../../../../packages/core/src/config.ts";
import type { DeviceCode } from "../../../../packages/core/src/types.ts";
import { saveTokens } from "./chatgpt.ts";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const config = resolveConfig();
const deviceFile = path.join(process.cwd(), ".image-studio-device.json");

export async function startLogin() {
  const device = await requestDeviceCode(config);
  await writeFile(deviceFile, `${JSON.stringify(device, null, 2)}\n`);
  return device;
}

export async function pollLogin() {
  const device = await readDevice();
  if (!device) return { status: "missing" as const };
  const result = await pollDeviceCode(config, device);
  if (result.status === "pending") return { status: "pending" as const };
  const tokens = await exchangeDeviceAuthorization(config, result);
  await saveTokens(tokens);
  await clearDevice();
  return { status: "authenticated" as const, accountId: tokens.accountId };
}

async function readDevice(): Promise<DeviceCode | undefined> {
  try {
    return JSON.parse(await readFile(deviceFile, "utf8")) as DeviceCode;
  } catch {
    return undefined;
  }
}

async function clearDevice(): Promise<void> {
  try {
    await unlink(deviceFile);
  } catch {}
}
