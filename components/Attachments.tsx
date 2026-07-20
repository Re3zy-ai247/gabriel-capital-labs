"use client";
import { useRef, useState } from "react";
import { Paperclip, X, FileText, Image as ImageIcon } from "lucide-react";
import {
  ATTACH_LIMITS, isAllowedMime, isImageMime, formatBytes, attachmentUrl, type AttachmentMeta,
} from "@/lib/attachmentsShared";

// Pull image files out of a paste event — lets users paste a screenshot straight
// into a composer. Use on the textarea's onPaste.
export function imagesFromClipboard(e: React.ClipboardEvent): File[] {
  const items = e.clipboardData?.items;
  if (!items) return [];
  const out: File[] = [];
  for (const it of Array.from(items)) {
    if (it.kind === "file" && it.type.startsWith("image/")) {
      const f = it.getAsFile();
      if (f) out.push(new File([f], f.name || `screenshot-${out.length + 1}.png`, { type: f.type }));
    }
  }
  return out;
}

// Drag-and-drop / click / paste picker. Controlled: the parent owns the File[].
export function AttachmentPicker({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function add(incoming: File[]) {
    if (!incoming.length) return;
    setErr(null);
    const next = [...files];
    let rejectedType = false;
    for (const f of incoming) {
      if (!isAllowedMime(f.type)) { rejectedType = true; continue; }
      if (f.size > ATTACH_LIMITS.maxBytes) {
        setErr(`"${f.name}" is over ${ATTACH_LIMITS.maxBytes / (1024 * 1024)}MB.`);
        continue;
      }
      if (next.length >= ATTACH_LIMITS.maxPerPost) {
        setErr(`Up to ${ATTACH_LIMITS.maxPerPost} files per message.`);
        break;
      }
      // Skip exact duplicates (same name + size).
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      next.push(f);
    }
    if (rejectedType) setErr("Only images and PDFs are supported.");
    onChange(next);
  }

  function remove(i: number) {
    onChange(files.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      {/* A real <button>, not a role="button" div: the div carried tabIndex={0} with
          no key handler, so it could be focused but never activated — keyboard and
          switch users could not attach a file on any of the three write paths that
          use this picker (WCAG 2.1.1). A native button gets Enter/Space for free. */}
      <button
        type="button"
        disabled={disabled}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled) add(Array.from(e.dataTransfer.files)); }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-[11px] transition ${
          drag ? "border-brand-500 bg-brand-500/10 text-brand-300" : "border-ink-600 text-slate-500 hover:border-slate-500"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <Paperclip className="h-3.5 w-3.5" />
        Drag &amp; drop, paste a screenshot, or click to attach (images / PDF)
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => { add(Array.from(e.target.files || [])); e.target.value = ""; }}
      />
      {err && <p className="mt-1 text-[11px] text-rose-400">{err}</p>}
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 bg-ink-800/60 px-2 py-1 text-[11px] text-slate-300">
              {isImageMime(f.type) ? <ImageIcon className="h-3 w-3 text-brand-400" /> : <FileText className="h-3 w-3 text-brand-400" />}
              <span className="max-w-[140px] truncate">{f.name}</span>
              <span className="text-slate-500">{formatBytes(f.size)}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); remove(i); }} className="text-slate-500 hover:text-rose-400" aria-label="Remove">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Renders saved attachments in a message/post: images as thumbnails (click to
// open full size), other files as download chips. All go through the
// authenticated stream route — never a public URL.
export function AttachmentList({ items }: { items?: AttachmentMeta[] | null }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((a) =>
        isImageMime(a.mimeType) ? (
          <a key={a.id} href={attachmentUrl(a.id)} target="_blank" rel="noreferrer" className="block" title={a.filename}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachmentUrl(a.id)} alt={a.filename} className="max-h-44 max-w-[220px] rounded-lg border border-ink-700 object-cover" />
          </a>
        ) : (
          <a
            key={a.id}
            href={attachmentUrl(a.id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-800/60 px-3 py-2 text-xs text-slate-300 transition hover:border-brand-500/50"
          >
            <FileText className="h-4 w-4 shrink-0 text-brand-400" />
            <span className="max-w-[180px] truncate">{a.filename}</span>
            <span className="text-slate-500">{formatBytes(a.byteSize)}</span>
          </a>
        )
      )}
    </div>
  );
}
