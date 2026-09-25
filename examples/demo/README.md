# Login with ChatGPT demo

Local Bun demo for the SDK.

```bash
bun install
bun run demo
```

Default URL: http://localhost:3000.

The demo:

- mounts `createChatGPTHandler()` at `/api/chatgpt/*`
- renders a centered sign-in gate before authentication
- opens the OpenAI device-code verification flow
- lists available models with `chatgpt.listModels()`
- streams a prompt through the browser-safe AI SDK proxy

Optional local secret:

```bash
LWC_SECRET="$(openssl rand -hex 32)" bun run demo
```

Headless CLI example:

```bash
bun --cwd examples/demo run src/login-cli.ts "Explain promises in one line"
```

Node-based image generation workflow:

```bash
pnpm --dir examples/demo run image "A cinematic product shot of a glass keyboard" --size 1024x1024 --format png
```

Generated files are written to `examples/demo/out/images`. The CLI stores local
ChatGPT tokens in `examples/demo/.lwc-image-tokens.json` for reuse.

## Album persistence (Convex, optional)

The browser studio keeps images in memory unless a Convex store is
configured. Generated PNGs live in Convex file storage; `convex/` holds the
schema (`images` table) and the `album:list` / `album:save` / `album:remove`
functions. The demo server exposes them at `GET`/`POST`/`DELETE /api/album`
and answers `501 album_store_not_configured` when no store is set, in which
case the UI falls back to in-memory cards.

One-time setup (needs a Convex account):

```bash
cd examples/demo
bunx convex login
bunx convex dev
```

`convex dev` prints your deployment URL and writes it to `.env.local`.
Then run the demo with that URL visible (new terminal):

```powershell
$env:CONVEX_URL="https://YOUR-DEPLOYMENT.convex.cloud"; bun run demo
```

Keep `bunx convex dev` running in another terminal while developing so
schema/function changes redeploy. Without `CONVEX_URL` the album simply
does not persist — everything else works.
