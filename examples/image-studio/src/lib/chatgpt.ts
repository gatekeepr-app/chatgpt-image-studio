import { DEFAULT_MODEL } from "../../../../packages/core/src/constants.ts";
import { createCodexFetch, listCodexModels, type CodexAuth } from "../../../../packages/core/src/codex-transport.ts";
import { resolveConfig } from "../../../../packages/core/src/config.ts";
import { ChatGPTAuthError } from "../../../../packages/core/src/errors.ts";
import { ensureFreshTokens, isAccessTokenExpired } from "../../../../packages/core/src/tokens.ts";
import type { ChatGPTTokens } from "../../../../packages/core/src/types.ts";
import {
  createChatGPTImagesClient,
  type ChatGPTGenerateImageOptions,
} from "../../../../packages/ai/src/images.ts";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const tokenFile = path.join(process.cwd(), ".image-studio-tokens.json");
const config = resolveConfig();

export async function loadTokens(): Promise<ChatGPTTokens | undefined> {
  try {
    return JSON.parse(await readFile(tokenFile, "utf8")) as ChatGPTTokens;
  } catch {
    return undefined;
  }
}

export async function saveTokens(tokens: ChatGPTTokens): Promise<void> {
  await writeFile(tokenFile, `${JSON.stringify(tokens, null, 2)}\n`);
}

export async function clearTokens(): Promise<void> {
  try {
    await unlink(tokenFile);
  } catch {}
}

export async function getAuth(): Promise<CodexAuth> {
  let tokens = await loadTokens();
  if (!tokens) throw new ChatGPTAuthError("invalid_token", "Sign in first.");
  if (isAccessTokenExpired(tokens) && !tokens.refreshToken) {
    await clearTokens();
    throw new ChatGPTAuthError("invalid_token", "Session expired; sign in again.");
  }
  tokens = await ensureFreshTokens(config, tokens, { onRefresh: saveTokens });
  if (!tokens.accountId) throw new ChatGPTAuthError("invalid_token", "ChatGPT tokens are missing an account id.");
  return { accessToken: tokens.accessToken, accountId: tokens.accountId };
}

export async function models(): Promise<string[]> {
  return listCodexModels({ config, getAuth });
}

export async function generateImages(options: ChatGPTGenerateImageOptions) {
  const fetch = createCodexFetch({ config, getAuth });
  const images = createChatGPTImagesClient({
    fetch,
    responsesUrl: `${config.codexBaseUrl}/responses`,
    defaultModel: options.model ?? DEFAULT_MODEL,
  });
  return images.generate(options);
}
