"use client";

import { useEffect, useState } from "react";

interface Album {
  id: string;
  name: string;
}

interface ImageRecord {
  id: string;
  albumId: string;
  prompt: string;
  model: string;
  edits?: string[];
}

interface AuthStatus {
  authenticated: boolean;
}

const ASPECT_RATIOS = [
  { label: "Square", value: "1024x1024" },
  { label: "Portrait", value: "1024x1536" },
  { label: "Landscape", value: "1536x1024" },
  { label: "Wide", value: "2048x1152" },
] as const;

export default function Page() {
  const [authenticated, setAuthenticated] = useState(false);
  const [login, setLogin] = useState<{ verificationUrl: string; userCode: string }>();
  const [models, setModels] = useState<string[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [albumId, setAlbumId] = useState("default");
  const [prompt, setPrompt] = useState("A cinematic product shot of a glass keyboard");
  const [model, setModel] = useState("");
  const [count, setCount] = useState(1);
  const [size, setSize] = useState<(typeof ASPECT_RATIOS)[number]["value"]>("1024x1024");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [previewImage, setPreviewImage] = useState<ImageRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editImageId, setEditImageId] = useState<string | undefined>(undefined);
  const [editPrompt, setEditPrompt] = useState("");

  async function refresh() {
    const status = await fetch("/api/auth/status").then((res) => res.json()) as AuthStatus;
    setAuthenticated(status.authenticated);
    setImages(
      (images?.map((img): ImageRecord => ({
        ...img,
        edits: img.edits ?? [],
      })) ?? [])
    );
    if (status.authenticated) {
      const response = await fetch("/api/models");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load models.");
      setModels(data.models);
      setModel((current) =>
        data.models.includes(current) ? current : data.models[0] ?? ""
      );
    } else {
      setModels([]);
      setModel("");
    }
  }

  async function startLogin() {
    const data = await fetch("/api/auth/start", { method: "POST" }).then((res) => res.json());
    setLogin(data);
    setMessage("Waiting for authorization...");
    const timer = window.setInterval(async () => {
      const poll = await fetch("/api/auth/poll").then((res) => res.json());
      if (poll.status === "authenticated") {
        window.clearInterval(timer);
        setLogin(undefined);
        setMessage("Connected.");
        await refresh();
      } else if (poll.status === "missing") {
        window.clearInterval(timer);
        setMessage("Login session was lost. Start sign in again.");
      }
    }, 5000);
  }

  async function createAlbum() {
    const name = window.prompt("Album name");
    if (!name) return;
    const album = await fetch("/api/albums", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((res) => res.json());
    setAlbums((current) => [album, ...current]);
    setAlbumId(album.id);
  }

  async function generate() {
    const selectedModel = model || models[0] || "";
    if (!selectedModel) {
      setMessage("Connect and choose a model first.");
      return;
    }
    setBusy(true);
    setMessage("Generating...");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, albumId, model: selectedModel, size, format: "png", quality: "high", n: count }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Generation failed.");
      setImages((current) => {
        const newItems = data.images.map(() => ({
          id: crypto.randomUUID(),
          albumId,
          prompt,
          model: selectedModel,
          edits: [],
        }));
        return [...current, ...newItems];
      });
      setMessage("Saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      setBusy(false);
    }
  }

  function getImage(id: string) {
    return images.find((i) => i.id === id);
  }

  function openEdit(id: string) {
    const img = getImage(id);
    if (!img) return;
    setEditImageId(id);
    setEditPrompt(img.prompt ?? "");
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditImageId(undefined);
    setEditPrompt("");
  }

  function applyEdit() {
    if (!editImageId || editPrompt.trim().length === 0) return;
    setImages((cur) =>
      cur.map((img) =>
        img.id === editImageId
          ? { ...img, prompt: editPrompt.trim(), edits: [...(img.edits ?? []), img.prompt ?? ""] }
          : img
      )
    );
    closeEdit();
  }

  const selectedAlbum = albums.find((album) => album.id === albumId);
  const visible = images.filter((image) => image.albumId === albumId);
  const canGenerate = authenticated && Boolean(model) && !busy;

  return (
    <main className="flex min-h-screen">
      <aside className="w-64 bg-black text-white flex flex-col py-8">
        <div className="text-center text-xl font-bold mb-8">Studio</div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Model</label>
            <select
              className="bg-gray-900 text-white border rounded w-full p-2"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!authenticated || !models.length}
            >
              {!models.length && <option value="">Connect to load models</option>}
              {models.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Aspect</label>
            <select
              className="bg-gray-900 text-white border rounded w-full p-2"
              value={size}
              onChange={(e) => setSize(e.target.value as typeof size)}
            >
              {ASPECT_RATIOS.map((ratio) => (
                <option key={ratio.value} value={ratio.value}>
                  {ratio.label} · {ratio.value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Prompt</label>
            <textarea
              className="bg-gray-900 text-white border rounded w-full p-2 h-24"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
          <button
            className="mt-4 w-full bg-white text-black rounded py-2"
            disabled={!canGenerate}
            onClick={generate}
          >
            {busy ? "Generating" : "Generate"}
          </button>
          <p className="mt-2 text-gray-400 text-sm">{message || "Images save into the selected album."}</p>
        </div>

        <div className="mt-6">
          <span className="block text-sm text-gray-400 mb-2">Albums</span>
          <div className="space-y-1">
            {albums.map((album) => (
              <div
                key={album.id}
                className={`flex items-center rounded bg-gray-900 px-3 py-1 ${
                  album.id === albumId ? "text-white" : "text-gray-300"
                }`}
                onClick={() => setAlbumId(album.id)}
              >
                <span className="w-3 h-3 rounded bg-gray-600 mr-2" />
                <span>{album.name}</span>
                <span className="text-xs text-gray-500">{images.filter((i) => i.albumId === album.id).length} images</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex-1 bg-gray-100 min-h-screen p-6">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <p className="text-gray-500">{selectedAlbum?.name ?? "Main"}</p>
            <h1 className="text-2xl">{visible.length} image{visible.length === 1 ? "" : "s"}</h1>
          </div>
          <div className="flex items-center">
            {authenticated ? (
              <button className="mt-4 w-full bg-white text-black rounded py-2" onClick={refresh}>
                ✓ Refresh
              </button>
            ) : (
              <button className="mt-4 w-full bg-white text-black rounded py-2" onClick={startLogin}>
                ↗ Sign in
              </button>
            )}
          </div>
        </div>

        {login && (
          <div className="mb-6 rounded bg-gray-900 p-4">
            <div>Open device login</div>
            <span className="ml-2 font-medium">{login?.userCode ?? ""}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((image) => (
            <div
              key={image.id}
              className={`rounded bg-gray-900 overflow-hidden hover:shadow-lg transition-shadow`}
            >
              <img
                src={`/api/images/${image.id}`}
                alt={image.prompt}
                className="w-full h-48 object-cover"
              />
              <div className="p-2 text-sm">
                <p className="text-gray-300 truncate">{image.prompt}</p>
                {image.edits && image.edits.length > 0 && (
                  <span className="text-yellow-400 text-xs ml-1">✎</span>
                )}
              </div>
              <div className="p-2 text-xs text-gray-400">
                <a
                  href={`/api/images/${image.id}`}
                  download={`image-${image.id}.png`}
                  className="text-blue-400 underline"
                >
                  Download
                </a>
                <span className="ml-2 text-gray-500">·</span>
                <button
                  className="text-green-400 cursor-pointer"
                  onClick={() => setPreviewImage(image)}
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

