/**
 * Node image generation workflow using the signed-in user's ChatGPT plan.
 *
 *   pnpm --dir examples/demo run image "A cinematic product shot of a glass keyboard"
 */
import { DEFAULT_MODEL } from "../../../packages/core/src/constants.ts";
import { createCodexFetch, listCodexModels, type CodexAuth } from "../../../packages/core/src/codex-transport.ts";
import { resolveConfig } from "../../../packages/core/src/config.ts";
import { requestDeviceCode, waitForDeviceTokens } from "../../../packages/core/src/device.ts";
import { ChatGPTAuthError } from "../../../packages/core/src/errors.ts";
import { ensureFreshTokens, isAccessTokenExpired } from "../../../packages/core/src/tokens.ts";
import type { ChatGPTTokens } from "../../../packages/core/src/types.ts";
import {
  createChatGPTImagesClient,
  type ChatGPTImageFormat,
  type ChatGPTImageQuality,
} from "../../../packages/ai/src/images.ts";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

interface CliOptions {
  prompt: string;
  outDir: string;
  model?: string;
  size?: `${number}x${number}` | "auto";
  format: ChatGPTImageFormat;
  quality?: ChatGPTImageQuality;
  n: number;
}

const tokenFile = fileURLToPath(new URL("../.lwc-image-tokens.json", import.meta.url));
const config = resolveConfig();
const options = parseArgs(process.argv.slice(2));
let current = await loadTokens() ?? await login();
const getAuth = async (): Promise<CodexAuth> => {
  if (isAccessTokenExpired(current) && !current.refreshToken) current = await login();
  current = await ensureFreshTokens(config, current, { onRefresh: saveTokens });
  if (!current.accountId) {
    throw new ChatGPTAuthError("invalid_token", "ChatGPT tokens are missing an account id; sign in again.");
  }
  return { accessToken: current.accessToken, accountId: current.accountId };
};
const codexFetch = createCodexFetch({ config, getAuth });
const images = createChatGPTImagesClient({
  fetch: codexFetch,
  responsesUrl: `${config.codexBaseUrl}/responses`,
  defaultModel: options.model ?? DEFAULT_MODEL,
});

const models = await listCodexModels({ config, getAuth });
const model = options.model ?? models[0];
if (!model) throw new Error("No ChatGPT models were returned for this account.");

console.log(`Generating ${options.n} image${options.n === 1 ? "" : "s"} with ${model}...`);
const result = await images.generate({
  model,
  prompt: options.prompt,
  size: options.size,
  format: options.format,
  quality: options.quality,
  n: options.n,
});

await mkdir(options.outDir, { recursive: true });
for (const [index, image] of result.data.entries()) {
  const suffix = result.data.length === 1 ? "" : `-${index + 1}`;
  const path = `${options.outDir}/image${suffix}.${image.format}`;
  await writeFile(path, Buffer.from(image.base64, "base64"));
  console.log(path);
}

function parseArgs(args: string[]): CliOptions {
  const values: Record<string, string> = {};
  const promptParts: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}.`);
      values[key] = value;
      i += 1;
    } else {
      promptParts.push(arg);
    }
  }

  const prompt = promptParts.join(" ").trim();
  if (!prompt) {
    throw new Error(
      'Usage: pnpm --dir examples/demo run image "prompt" [--out out/images] [--model gpt-5.5] [--size 1024x1024] [--format png|jpeg|webp] [--quality low|medium|high|auto] [--n 2]',
    );
  }

  return {
    prompt,
    outDir: values.out ?? "out/images",
    model: values.model,
    size: values.size as CliOptions["size"],
    format: (values.format as ChatGPTImageFormat | undefined) ?? "png",
    quality: values.quality as ChatGPTImageQuality | undefined,
    n: values.n ? Number.parseInt(values.n, 10) : 1,
  };
}

async function loadTokens(): Promise<ChatGPTTokens | undefined> {
  try {
    return JSON.parse(await readFile(tokenFile, "utf8")) as ChatGPTTokens;
  } catch {
    return undefined;
  }
}

async function saveTokens(tokens: ChatGPTTokens): Promise<void> {
  await writeFile(tokenFile, `${JSON.stringify(tokens, null, 2)}\n`);
}

async function login(): Promise<ChatGPTTokens> {
  const device = await requestDeviceCode(config);
  console.log("\nSign in with ChatGPT");
  console.log(`1. Open: ${device.verificationUrl}`);
  console.log(`2. Enter code: ${device.userCode}\n`);

  process.stdout.write("Waiting for authorization...");
  const tokens = await waitForDeviceTokens(config, device, {
    onPoll: (n) => process.stdout.write(`\rWaiting for authorization... (poll ${n})   `),
  });
  console.log(`\nSigned in (account ${tokens.accountId}).\n`);
  await saveTokens(tokens);
  return tokens;
}
