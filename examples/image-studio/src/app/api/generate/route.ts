import { mkdir, writeFile } from "node:fs/promises";
import { generateImages } from "../../../lib/chatgpt.ts";
import { imagePath, readState, writeState, type ImageRecord } from "../../../lib/store.ts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    prompt?: string;
    albumId?: string;
    model?: string;
    size?: "auto" | `${number}x${number}`;
    format?: "png" | "jpeg" | "webp";
    quality?: "auto" | "low" | "medium" | "high";
    n?: number;
  };
  const prompt = body.prompt?.trim();
  if (!prompt) return Response.json({ error: "Prompt is required." }, { status: 400 });

  const state = await readState();
  const albumId = body.albumId && state.albums.some((album) => album.id === body.albumId) ? body.albumId : "default";
  const model = body.model?.trim() || undefined;
  const result = await generateImages({
    prompt,
    model,
    size: body.size,
    format: body.format ?? "png",
    quality: body.quality,
    n: body.n ?? 1,
  });

  const records: ImageRecord[] = [];
  for (const image of result.data) {
    const id = crypto.randomUUID();
    const file = `${albumId}/${id}.${image.format}`;
    await mkdir(imagePath(albumId), { recursive: true });
    await writeFile(imagePath(file), Buffer.from(image.base64, "base64"));
    records.push({
      id,
      albumId,
      prompt,
      model: model ?? "auto",
      format: image.format,
      file,
      createdAt: new Date().toISOString(),
    });
  }

  state.images.unshift(...records);
  await writeState(state);
  return Response.json({ images: records });
}
