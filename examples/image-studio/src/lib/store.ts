import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface Album {
  id: string;
  name: string;
  createdAt: string;
}

export interface ImageRecord {
  id: string;
  albumId: string;
  prompt: string;
  model: string;
  format: string;
  file: string;
  createdAt: string;
}

export interface StudioState {
  albums: Album[];
  images: ImageRecord[];
}

export const dataDir = path.join(process.cwd(), "out", "image-studio");
const stateFile = path.join(dataDir, "state.json");

export async function readState(): Promise<StudioState> {
  await mkdir(dataDir, { recursive: true });
  try {
    return JSON.parse(await readFile(stateFile, "utf8")) as StudioState;
  } catch {
    const now = new Date().toISOString();
    return { albums: [{ id: "default", name: "Main", createdAt: now }], images: [] };
  }
}

export async function writeState(state: StudioState): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`);
}

export function imagePath(file: string): string {
  return path.join(dataDir, file);
}