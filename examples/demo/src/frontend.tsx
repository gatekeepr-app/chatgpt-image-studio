import {
  ChatGPTImageError,
  createChatGPTImagesClient,
  type ChatGPTImageSize,
} from "@opencoredev/loginwithchatgpt-ai";
import {
  ChatGPTMark,
  openLoginWithChatGPTConsentPopup,
  useLoginWithChatGPT,
  type UseLoginWithChatGPTResult,
} from "@opencoredev/loginwithchatgpt-react";
import {
  ArrowUpRight,
  BookOpen,
  CaretDown,
  CircleNotch,
  Download,
  ImageSquare,
  SignOut,
  X,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const PREFERRED_MODEL = "gpt-5.5";
const CURATED_MODELS = [PREFERRED_MODEL, "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex-spark"];
const DOCS_URL = "http://localhost:3001";
const SIZES = [
  { label: "Square", value: "1024x1024" },
  { label: "Portrait", value: "1024x1536" },
  { label: "Landscape", value: "1536x1024" },
] as const;
const COUNTS = [1, 2, 4] as const;
const images = createChatGPTImagesClient({
  // Arrow wrapper: passing bare `fetch` detaches it from `window` and the
  // browser rejects the call with "Illegal invocation".
  fetch: (url, init) => fetch(url, init),
  responsesUrl: "/api/chatgpt/responses",
  credentials: "include",
  defaultModel: PREFERRED_MODEL,
});

type RemoteImage = {
  id: string;
  prompt: string;
  model: string;
  size: string;
  revisedPrompt?: string;
  url?: string | null;
};

async function loadAlbum(): Promise<{ images: RemoteImage[]; configured: boolean }> {
  const res = await fetch("/api/album");
  if (res.status === 501) return { images: [], configured: false };
  if (!res.ok) throw new Error("Could not load the album.");
  const data = await res.json();
  return { images: Array.isArray(data.images) ? data.images : [], configured: true };
}

async function saveToAlbum(input: {
  base64: string;
  prompt: string;
  model: string;
  size: string;
  revisedPrompt?: string;
}): Promise<{ id: string; url: string | null } | null> {
  const res = await fetch("/api/album", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 501) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not save the image.");
  return data;
}

async function deleteFromAlbum(id: string): Promise<void> {
  const res = await fetch(`/api/album?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (res.status === 501) return;
  if (!res.ok) throw new Error("Could not delete the image.");
}

interface AlbumImage extends RemoteImage {
  remoteId?: string;
  dataUrl?: string;
  ready: boolean;
}

const PROMPT_SUGGESTIONS = [
  "A cinematic product shot of a glass keyboard",
  "A paper-cut forest at dusk",
  "An astronaut riding a horse in photorealistic style",
];

function App() {
  const auth = useLoginWithChatGPT({ basePath: "/api/chatgpt" });
  if (auth.status === "loading") return <SessionLoading />;
  return auth.isAuthenticated ? <ImageStudio auth={auth} /> : <AuthGate auth={auth} />;
}

function SessionLoading() {
  return (
    <div className="auth auth-loading" aria-label="Checking session">
      <ChatGPTMark width={28} height={28} />
    </div>
  );
}

/* ─── Sign-in gate ─── */
function AuthGate({ auth }: { auth: UseLoginWithChatGPTResult }) {
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="mark">
          <ChatGPTMark width={34} height={34} />
        </div>
        {auth.isPending ? (
          <Device auth={auth} />
        ) : (
          <>
            <h1 className="auth-title">Log in with ChatGPT</h1>
            <p className="auth-sub">
              Generate images on your own ChatGPT plan. No API key or per-token billing.
            </p>
            <button
              className="btn-primary"
              onClick={() => {
                const popup = openLoginWithChatGPTConsentPopup({
                  appName: "Login with ChatGPT demo",
                  login: auth.login,
                  securityHref: `${DOCS_URL}/docs/security`,
                });
                if (!popup) void auth.login();
              }}
              disabled={auth.isConnecting}
            >
              {auth.isConnecting ? <CircleNotch className="spin" size={18} weight="bold" /> : <ChatGPTMark width={18} height={18} />}
              {auth.isConnecting ? "Connecting…" : "Login with ChatGPT"}
            </button>
            <a className="link" href={DOCS_URL} target="_blank" rel="noreferrer">
              <BookOpen size={15} /> Read the docs <ArrowUpRight size={13} />
            </a>
            {auth.status === "error" && <span className="error">Something went wrong. Try again.</span>}
          </>
        )}
      </div>
    </div>
  );
}

function Device({ auth }: { auth: UseLoginWithChatGPTResult }) {
  return (
    <div className="device">
      <span className="waiting">
        <CircleNotch className="spin" size={16} weight="bold" /> Waiting for authorization…
      </span>
      <div className="code-box">
        <span className="cap">Enter this code in the opened window</span>
        <div className="code-row">
          <span className="code">{auth.userCode}</span>
        </div>
      </div>
      <button className="link" onClick={() => auth.reopen()}>
        Reopen sign-in window <ArrowUpRight size={13} />
      </button>
    </div>
  );
}

/* ─── Image studio (album view) ─── */
function ImageStudio({ auth }: { auth: UseLoginWithChatGPTResult }) {
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [modelStatus, setModelStatus] = useState<"loading" | "ready">("loading");
  const [modelWarning, setModelWarning] = useState<string | undefined>();
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<ChatGPTImageSize>("1024x1024");
  const [count, setCount] = useState<number>(1);
  const [items, setItems] = useState<AlbumImage[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [running, setRunning] = useState(false);
  const [viewId, setViewId] = useState<string | undefined>();
  const [albumNotice, setAlbumNotice] = useState<string | undefined>();
  const logout = auth.logout;

  // Load the account's real model list.
  useEffect(() => {
    let active = true;
    setModelStatus("loading");
    fetch("/api/chatgpt/models")
      .then(async (res) => {
        if (!active) return;
        const data = await res.json();
        if (!res.ok || !Array.isArray(data.models) || data.models.length === 0) {
          applyPreferredModelFallback();
          return;
        }
        const verifiedModels = rankModels([...data.models, ...CURATED_MODELS]);
        setModels(verifiedModels);
        setModel((current) => {
          if (current && verifiedModels.includes(current)) return current;
          return verifiedModels.includes(PREFERRED_MODEL) ? PREFERRED_MODEL : (verifiedModels[0] ?? "");
        });
        setModelWarning(undefined);
        setModelStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        applyPreferredModelFallback();
      });

    function applyPreferredModelFallback() {
      if (!active) return;
      setModels([PREFERRED_MODEL]);
      setModel(PREFERRED_MODEL);
      setModelWarning("Could not refresh the account model list. Trying GPT-5.5.");
      setModelStatus("ready");
    }

    return () => {
      active = false;
    };
  }, []);

  // Load the persisted album once. Missing store (501) is not an error:
  // images simply stay in memory until CONVEX_URL is set.
  useEffect(() => {
    let active = true;
    loadAlbum()
      .then(({ images: remote, configured }) => {
        if (!active) return;
        if (!configured) {
          setAlbumNotice("Album store not configured — images stay in memory until you set CONVEX_URL.");
        }
        setItems(
          remote.map((record) => ({
            id: record.id,
            remoteId: record.id,
            prompt: record.prompt,
            model: record.model,
            size: record.size,
            url: record.url,
            revisedPrompt: record.revisedPrompt,
            ready: true,
          })),
        );
      })
      .catch(() => {
        if (active) setAlbumNotice("Could not reach the album store — images stay in memory.");
      });
    return () => {
      active = false;
    };
  }, []);

  async function generate() {
    const nextPrompt = prompt.trim();
    if (running || !model || !nextPrompt) return;
    const pendingIds = Array.from({ length: count }, () => crypto.randomUUID());
    setRunning(true);
    setError(undefined);
    setItems((prev) => [
      ...pendingIds.map((id) => ({
        id,
        prompt: nextPrompt,
        model,
        size,
        ready: false as const,
      })),
      ...prev,
    ]);
    try {
      const result = await images.generate({
        model,
        prompt: nextPrompt,
        size,
        format: "png",
        quality: "high",
        n: count,
        // Intermediate events keep the SSE stream alive during the long
        // silent generation window and paint the pending cards progressively.
        partialImages: 2,
        onPartialImage: (partial) => {
          const targetId = pendingIds[partial.imageIndex];
          if (!targetId) return;
          setItems((prev) =>
            prev.map((item) => (item.id === targetId ? { ...item, dataUrl: partial.dataUrl } : item)),
          );
        },
      });
      let storeConfigured = true;
      const finished: AlbumImage[] = await Promise.all(
        result.data.map(async (image, index) => {
          const card: AlbumImage = {
            id: pendingIds[index] ?? crypto.randomUUID(),
            prompt: nextPrompt,
            model,
            size,
            dataUrl: image.dataUrl,
            revisedPrompt: image.revisedPrompt,
            ready: true,
          };
          try {
            const saved = await saveToAlbum({
              base64: image.base64,
              prompt: nextPrompt,
              model,
              size,
              revisedPrompt: image.revisedPrompt,
            });
            if (!saved) {
              storeConfigured = false;
              return card;
            }
            return { ...card, id: saved.id, remoteId: saved.id, url: saved.url };
          } catch {
            return card;
          }
        }),
      );
      if (!storeConfigured) {
        setAlbumNotice("Album store not configured — images stay in memory until you set CONVEX_URL.");
      }
      setItems((prev) => [...finished, ...prev.filter((item) => !pendingIds.includes(item.id))]);
      setPrompt("");
    } catch (e) {
      if (e instanceof ChatGPTImageError && e.status === 401) {
        void logout();
        return;
      }
      setError(e instanceof Error ? e.message : "Image generation failed.");
      setItems((prev) => prev.filter((item) => !pendingIds.includes(item.id)));
    } finally {
      setRunning(false);
    }
  }

  function removeImage(id: string) {
    const item = items.find((entry) => entry.id === id);
    if (item?.remoteId) void deleteFromAlbum(item.remoteId).catch(() => {});
    setItems((prev) => prev.filter((entry) => entry.id !== id));
    if (viewId === id) setViewId(undefined);
  }

  const viewing = viewId ? items.find((item) => item.id === viewId) : undefined;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            <span className="brand-mark">
              <ChatGPTMark width={16} height={16} />
            </span>
          </span>
          <span className="demo-warning">Image studio · {items.filter((i) => i.ready).length} images</span>
          <span className="spacer" />
          <a className="top-link" href={DOCS_URL} target="_blank" rel="noreferrer">
            <BookOpen size={15} /> Docs
          </a>
          <button className="ghost-btn" onClick={() => void auth.logout()}>
            <SignOut size={15} /> Sign out
          </button>
        </div>
      </header>

      <div className="workspace workspace-studio">
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <label className="sr-only" htmlFor="prompt">Image prompt</label>
          <textarea
            id="prompt"
            className="textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void generate();
              }
            }}
            placeholder="Describe the image…"
            spellCheck={false}
          />
          <div className="composer-bottom">
            <div className="composer-tools">
              <div className="select-wrap">
                <select
                  aria-label="Model"
                  disabled={modelStatus !== "ready"}
                  id="model"
                  className="select"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {modelStatus === "loading" && <option value="">Loading models...</option>}
                  {modelStatus === "ready" &&
                    models.map((m) => (
                      <option key={m} value={m}>{labelModel(m)}</option>
                    ))}
                </select>
                <CaretDown className="select-caret" size={14} />
              </div>
              <div className="select-wrap">
                <select
                  aria-label="Size"
                  className="select"
                  value={size}
                  onChange={(e) => setSize(e.target.value as ChatGPTImageSize)}
                >
                  {SIZES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label} · {s.value}</option>
                  ))}
                </select>
                <CaretDown className="select-caret" size={14} />
              </div>
              <div className="select-wrap">
                <select
                  aria-label="Count"
                  className="select"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                >
                  {COUNTS.map((n) => (
                    <option key={n} value={n}>{n} image{n === 1 ? "" : "s"}</option>
                  ))}
                </select>
                <CaretDown className="select-caret" size={14} />
              </div>
            </div>
            <button
              className="send"
              type="submit"
              disabled={running || !model || !prompt.trim()}
            >
              {running ? <CircleNotch className="spin" size={17} weight="bold" /> : <ImageSquare size={17} weight="fill" />}
              {running ? "Dreaming" : "Generate"}
            </button>
          </div>
          {modelWarning && <span className="model-note">{modelWarning}</span>}
          {!modelWarning && albumNotice && <span className="model-note">{albumNotice}</span>}
        </form>

        <section className="response">
          {error ? (
            <div className="error">
              <span>{error}</span>
              <button className="error-action" onClick={() => setError(undefined)} type="button">
                Dismiss
              </button>
            </div>
          ) : items.length > 0 ? (
            <div className="album-grid">
              {items.map((item) => (
                <article className="art-card" key={item.id}>
                  {(item.url ?? item.dataUrl) ? (
                    <button className="art-view" onClick={() => setViewId(item.id)} type="button" aria-label="View image">
                      <img className="art" src={item.url ?? item.dataUrl ?? ""} alt={item.prompt} />
                    </button>
                  ) : (
                    <div className="art-pending" aria-label="Generating image">
                      <CircleNotch className="spin" size={22} weight="bold" />
                    </div>
                  )}
                  <div className="art-body">
                    <span className="art-prompt" title={item.revisedPrompt ?? item.prompt}>{item.prompt}</span>
                    <span className="art-meta">{labelModel(item.model)} · {item.size}</span>
                    <div className="art-actions">
                      {(item.dataUrl ?? item.url) && (
                        <a className="copy-inline" href={item.dataUrl ?? item.url ?? ""} download={`image-${item.id}.png`}>
                          <Download size={14} /> Save
                        </a>
                      )}
                      <button className="copy-inline" onClick={() => removeImage(item.id)} type="button">
                        <X size={14} weight="bold" /> Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <ImageSquare size={28} />
              <h1>Describe an image</h1>
              <p>Pick a model and size, write a prompt, and generate through your ChatGPT session.</p>
              <div className="suggestions" aria-label="Example prompts">
                {PROMPT_SUGGESTIONS.map((suggestion) => (
                  <button className="suggestion" key={suggestion} onClick={() => setPrompt(suggestion)} type="button">
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {viewing && (viewing.url ?? viewing.dataUrl) && (
        <div className="lightbox" onClick={() => setViewId(undefined)}>
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={viewing.url ?? viewing.dataUrl ?? ""} alt={viewing.prompt} />
            <figcaption>{viewing.prompt}</figcaption>
            <div className="art-actions">
              <a className="copy-inline" href={viewing.dataUrl ?? viewing.url ?? ""} download={`image-${viewing.id}.png`}>
                <Download size={14} /> Save
              </a>
              <button className="copy-inline" onClick={() => setViewId(undefined)} type="button">
                <X size={14} weight="bold" /> Close
              </button>
            </div>
          </figure>
        </div>
      )}
    </div>
  );
}

function rankModels(accountModels: string[]) {
  const unique = [...new Set(accountModels)];
  const priority = new Map(CURATED_MODELS.map((m, index) => [m, index]));
  return unique.sort((a, b) => {
    const aPriority = priority.get(a);
    const bPriority = priority.get(b);
    if (aPriority !== undefined || bPriority !== undefined) {
      return (aPriority ?? 999) - (bPriority ?? 999);
    }
    return a.localeCompare(b);
  });
}

function labelModel(model: string) {
  if (model === PREFERRED_MODEL) return "GPT-5.5";
  if (model === "gpt-5.4") return "GPT-5.4";
  if (model === "gpt-5.4-mini") return "GPT-5.4 mini";
  if (model === "gpt-5.3-codex-spark") return "GPT-5.3 Codex Spark";
  if (model.includes("spark")) {
    return model
      .split("-")
      .map((part) => (part === "gpt" ? "GPT" : part.charAt(0).toUpperCase() + part.slice(1)))
      .join(" ");
  }
  return model;
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
