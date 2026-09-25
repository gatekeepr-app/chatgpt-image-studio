import { readFile } from "node:fs/promises";
import { imagePath, readState } from "../../../../lib/store.ts";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const state = await readState();
  const image = state.images.find((item) => item.id === id);
  if (!image) return new Response("Not found", { status: 404 });
  const bytes = await readFile(imagePath(image.file));
  return new Response(bytes, { headers: { "content-type": `image/${image.format}` } });
}
