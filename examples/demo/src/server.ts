import { fileURLToPath } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { createChatGPTHandler, type KeyValueStore, type StoredSession } from "@opencoredev/loginwithchatgpt-server";
import index from "./index.html";

interface FileStoreEntry<T> {
  value: T;
  expiresAt?: number;
}

class FileSessionStore<T> implements KeyValueStore<T> {
  constructor(private readonly path: string) {}

  async get(key: string): Promise<T | undefined> {
    const entries = await this.read();
    const entry = entries[key];
    if (!entry) return undefined;
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      delete entries[key];
      await this.write(entries);
      return undefined;
    }
    return entry.value;
  }

  async set(key: string, value: T, options: { ttlMs?: number } = {}): Promise<void> {
    const entries = await this.read();
    entries[key] = {
      value,
      expiresAt: options.ttlMs !== undefined ? Date.now() + options.ttlMs : undefined,
    };
    await this.write(entries);
  }

  async delete(key: string): Promise<void> {
    const entries = await this.read();
    delete entries[key];
    await this.write(entries);
  }

  private async read(): Promise<Record<string, FileStoreEntry<T>>> {
    try {
      return (await Bun.file(this.path).json()) as Record<string, FileStoreEntry<T>>;
    } catch {
      return {};
    }
  }

  private async write(entries: Record<string, FileStoreEntry<T>>): Promise<void> {
    await Bun.write(this.path, `${JSON.stringify(entries, null, 2)}\n`);
  }
}

const sessionFile = fileURLToPath(new URL("../.lwc-demo-session.json", import.meta.url));
const sessionStore = new FileSessionStore<StoredSession>(sessionFile);

/**
 * Demo backend. Mounts the Login with ChatGPT handler at `/api/chatgpt/*` and
 * serves the single-page frontend. In production, set `LWC_SECRET` to a stable
 * random string and swap `sessionStore` for a shared store (Redis/Upstash/DB).
 */
const auth = createChatGPTHandler({
  basePath: "/api/chatgpt",
  secret: process.env.LWC_SECRET ?? "login-with-chatgpt-local-demo-secret",
  sessionStore,
  defaultModel: "gpt-5.5",
  responsesProxy: {
    allowedModels: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex-spark"],
    maxRequestBytes: 40 * 1024 * 1024,
  },
  // instructions: "You are a helpful assistant.",
});

const convexUrl = process.env.CONVEX_URL ?? process.env.CONVEX_DEPLOYMENT;
const convex = convexUrl ? new ConvexHttpClient(convexUrl) : undefined;

interface AlbumRecord {
  id: string;
  prompt: string;
  model: string;
  size: string;
  revisedPrompt?: string;
  url: string | null;
}

/**
 * Album persistence backed by Convex. String function refs (instead of the
 * generated `api` object) keep this file compiling and booting before
 * `bunx convex dev` has generated `./_generated` for the first time.
 */
async function handleAlbum(request: Request): Promise<Response> {
  const session = await auth.getSession(request);
  if (session.status !== "authenticated") {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }
  if (!convex) {
    return Response.json(
      {
        error: "album_store_not_configured",
        message: "Set CONVEX_URL to persist the album (run `bunx convex dev` in examples/demo).",
      },
      { status: 501 },
    );
  }
  const call = {
    query: (name: string, args: Record<string, unknown>) =>
      (convex.query as unknown as (name: string, args: Record<string, unknown>) => Promise<unknown>)(name, args),
    mutation: (name: string, args: Record<string, unknown>) =>
      (convex.mutation as unknown as (name: string, args: Record<string, unknown>) => Promise<unknown>)(name, args),
  };
  try {
    if (request.method === "GET") {
      const images = (await call.query("album:list", {})) as AlbumRecord[];
      return Response.json({ images });
    }
    if (request.method === "POST") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: "invalid_album_request" }, { status: 400 });
      }
      const record = body as Record<string, unknown>;
      if (
        typeof record.prompt !== "string" || !record.prompt.trim() ||
        typeof record.model !== "string" ||
        typeof record.size !== "string" ||
        typeof record.base64 !== "string"
      ) {
        return Response.json({ error: "invalid_album_request" }, { status: 400 });
      }
      const binary = atob(record.base64);
      if (binary.length === 0 || binary.length > 15 * 1024 * 1024) {
        return Response.json({ error: "invalid_album_request" }, { status: 400 });
      }
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) ?? 0;
      const saved = (await call.mutation("album:save", {
        data: bytes,
        prompt: record.prompt,
        model: record.model,
        size: record.size,
        revisedPrompt: typeof record.revisedPrompt === "string" ? record.revisedPrompt : undefined,
      })) as { id: string; url: string | null };
      return Response.json(saved, { status: 201 });
    }
    if (request.method === "DELETE") {
      const id = new URL(request.url).searchParams.get("id");
      if (!id) return Response.json({ error: "invalid_album_request" }, { status: 400 });
      await call.mutation("album:remove", { id });
      return Response.json({ ok: true });
    }
    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    return Response.json(
      { error: "album_store_failed", detail: (error as Error).message },
      { status: 502 },
    );
  }
}

const port = Number(process.env.PORT ?? 3000);

const server = Bun.serve({
  port,
  // Image generation streams can sit silent for a minute or more; Bun's
  // default 10s idle timeout would sever them mid-flight (the browser
  // reports it as ERR_INCOMPLETE_CHUNKED_ENCODING). 255 is Bun's maximum.
  idleTimeout: 255,
  routes: {
    "/": index,
    "/api/album": (req) => handleAlbum(req),
    "/api/chatgpt/*": (req) => auth.handler(req),
  },
  development: process.env.NODE_ENV !== "production" && { hmr: true, console: true },
});

console.log(`\n  Login with ChatGPT demo → ${server.url}\n`);
