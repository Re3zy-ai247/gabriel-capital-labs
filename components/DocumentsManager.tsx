"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2, Upload, Trash2, FileText, CreditCard, MapPin, ShieldAlert, Eye } from "lucide-react";

type DocType = "GOV_ID_FRONT" | "GOV_ID_BACK" | "SSN_CARD" | "PROOF_OF_ADDRESS" | "UTILITY_BILL";
interface Doc {
  id: string;
  type: DocType;
  filename: string;
  mimeType: string;
  byteSize: number;
  includeInLetters: boolean;
  createdAt: string;
}

const TYPES: { type: DocType; label: string; hint?: string; icon: typeof CreditCard }[] = [
  { type: "GOV_ID_FRONT", label: "Government ID (Front)", icon: CreditCard },
  { type: "GOV_ID_BACK", label: "Government ID (Back)", icon: CreditCard },
  {
    type: "SSN_CARD",
    label: "SSN Card",
    hint: "Off by default — only enable if a bureau specifically requires it.",
    icon: ShieldAlert,
  },
  { type: "PROOF_OF_ADDRESS", label: "Proof of Address", icon: MapPin },
  { type: "UTILITY_BILL", label: "Utility Bill", icon: FileText },
];

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Toggle({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      title={on ? "Included in letter packets" : "Excluded from letter packets"}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition disabled:opacity-50",
        on ? "bg-emerald-500" : "bg-slate-600"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
          on ? "left-4" : "left-0.5"
        )}
      />
    </button>
  );
}

export function DocumentsManager() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState<DocType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cryptoReady, setCryptoReady] = useState(true);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function load() {
    try {
      const res = await fetch("/api/documents");
      const j = await res.json();
      if (res.ok) {
        setDocs(j.documents || []);
        setCryptoReady(j.cryptoReady !== false);
      }
    } catch {
      /* ignore — surfaced on action */
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const byType = (t: DocType) => docs.find((d) => d.type === t);

  async function upload(type: DocType, file: File) {
    setBusyType(type);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("type", type);
      fd.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Upload failed.");
        return;
      }
      setDocs((prev) => [j.document, ...prev.filter((d) => d.type !== type)]);
    } catch {
      setError("The connection dropped during the upload. Try again — nothing partial was kept.");
    } finally {
      setBusyType(null);
    }
  }

  async function toggle(doc: Doc) {
    const next = !doc.includeInLetters;
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, includeInLetters: next } : d)));
    const res = await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeInLetters: next }),
    });
    if (!res.ok) {
      // revert on failure
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, includeInLetters: !next } : d)));
    }
  }

  async function remove(doc: Doc) {
    setBusyType(doc.type);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (res.ok) setDocs((prev) => prev.filter((d) => d.id !== doc.id));
      else setError("Could not delete the document.");
    } finally {
      setBusyType(null);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
        <Upload className="h-4 w-4 text-brand-400" /> Documents &amp; Letter Attachments
      </div>
      <p className="mb-4 max-w-2xl text-xs text-slate-400">
        Upload identity and address documents. Files are encrypted at rest and only ever streamed back to you —
        they are never stored at a public link. Toggle which ones are referenced in your generated dispute packets.
      </p>

      {!cryptoReady && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-gold-500/40 bg-gold-500/10 p-3 text-xs text-gold-300">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Secure storage isn&apos;t configured yet (missing <code>DOCUMENT_ENCRYPTION_KEY</code>). Uploads are disabled.
        </div>
      )}
      {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening your documents…
        </div>
      ) : (
        <div className="space-y-2">
          {TYPES.map(({ type, label, hint, icon: Icon }) => {
            const doc = byType(type);
            const busy = busyType === type;
            return (
              <div
                key={type}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3",
                  doc ? "border-emerald-500/30 bg-emerald-500/[0.04]" : "border-ink-700/70"
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Icon className={cn("h-5 w-5 shrink-0", doc ? "text-emerald-400" : "text-slate-500")} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {label}
                      {doc ? (
                        <span className="pill bg-emerald-500/15 text-[10px] text-emerald-300">Attached</span>
                      ) : (
                        <span className="pill bg-ink-800 text-[10px] text-slate-400">Not uploaded</span>
                      )}
                    </div>
                    {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
                    {doc && (
                      <div className="truncate text-[11px] text-slate-500">
                        {doc.filename} · {prettySize(doc.byteSize)} ·{" "}
                        <a
                          href={`/api/documents/${doc.id}/raw`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-brand-400 underline"
                        >
                          <Eye className="h-3 w-3" /> View
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {doc && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="hidden sm:inline">In letters</span>
                      <Toggle on={doc.includeInLetters} onClick={() => toggle(doc)} />
                    </div>
                  )}
                  <input
                    ref={(el) => {
                      inputs.current[type] = el;
                    }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) upload(type, f);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy || !cryptoReady}
                    onClick={() => inputs.current[type]?.click()}
                    className="btn-ghost text-xs"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {doc ? "Replace" : "Upload"}
                  </button>
                  {doc && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(doc)}
                      className="text-slate-500 transition hover:text-rose-400"
                      title="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
