import { readState, writeState } from "../../../lib/store.ts";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await readState());
}

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string };
  const name = body.name?.trim();
  if (!name) return Response.json({ error: "Album name is required." }, { status: 400 });
  const state = await readState();
  const album = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString() };
  state.albums.unshift(album);
  await writeState(state);
  return Response.json(album);
}
