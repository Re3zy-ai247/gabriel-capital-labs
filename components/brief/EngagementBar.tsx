"use client";
import { useEffect, useRef, useState } from "react";
import { Heart, Bookmark, Share2, Link2, Check, Twitter, Facebook, Linkedin } from "lucide-react";

// Like / bookmark / share for a published Brief article. Likes + bookmarks need a
// signed-in account (any plan) — anonymous clicks route to /login. Sharing is open
// to everyone and only ever uses the article's pre-scrubbed caption/title, so no
// new (potentially non-compliant) copy is generated here.
interface Props {
  slug: string;
  shareText: string;
  isAuthed: boolean;
  initialLiked: boolean;
  initialBookmarked: boolean;
  initialLikeCount: number;
}

export function EngagementBar({ slug, shareText, isAuthed, initialLiked, initialBookmarked, initialLikeCount }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [busy, setBusy] = useState<"like" | "bookmark" | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shareOpen) return;
    function onDoc(e: MouseEvent) {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShareOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [shareOpen]);

  async function toggle(kind: "like" | "bookmark") {
    if (!isAuthed) {
      window.location.href = "/login";
      return;
    }
    if (busy) return;
    const wasOn = kind === "like" ? liked : bookmarked;
    const next = !wasOn;
    // Optimistic.
    setBusy(kind);
    if (kind === "like") {
      setLiked(next);
      setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    } else {
      setBookmarked(next);
    }
    try {
      const res = await fetch("/api/brief/react", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, kind }),
      });
      if (!res.ok) throw new Error("failed");
      const j = await res.json();
      if (typeof j.likeCount === "number") setLikeCount(j.likeCount);
    } catch {
      // Revert on failure.
      if (kind === "like") {
        setLiked(wasOn);
        setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      } else {
        setBookmarked(wasOn);
      }
    } finally {
      setBusy(null);
    }
  }

  function shareUrl(): string {
    return typeof window !== "undefined" ? window.location.href : `https://www.creditvector.app/brief/${slug}`;
  }

  async function onShare() {
    const url = shareUrl();
    if (typeof navigator !== "undefined" && (navigator as Navigator).share) {
      try {
        await (navigator as Navigator).share({ title: shareText, text: shareText, url });
        return;
      } catch {
        // user cancelled or unsupported — fall through to the menu
      }
    }
    setShareOpen((v) => !v);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  const intents = () => {
    const url = encodeURIComponent(shareUrl());
    const text = encodeURIComponent(shareText);
    return {
      x: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    };
  };

  const pill =
    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition disabled:opacity-60";

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2.5">
      <button
        onClick={() => toggle("like")}
        disabled={busy === "like"}
        aria-pressed={liked}
        aria-label={liked ? "Unlike this article" : "Like this article"}
        className={`${pill} ${liked ? "border-rose-500/40 bg-rose-500/10 text-rose-300" : "border-ink-700/70 text-slate-300 hover:border-rose-500/30 hover:text-rose-200"}`}
      >
        <Heart className="h-4 w-4" fill={liked ? "currentColor" : "none"} />
        <span className="tnum">{likeCount > 0 ? likeCount : ""}</span>
        <span className={likeCount > 0 ? "sr-only" : ""}>Like</span>
      </button>

      <button
        onClick={() => toggle("bookmark")}
        disabled={busy === "bookmark"}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? "Remove bookmark" : "Save article"}
        className={`${pill} ${bookmarked ? "border-brand-500/40 bg-brand-500/10 text-brand-300" : "border-ink-700/70 text-slate-300 hover:border-brand-500/30 hover:text-brand-200"}`}
      >
        <Bookmark className="h-4 w-4" fill={bookmarked ? "currentColor" : "none"} />
        {bookmarked ? "Saved" : "Save"}
      </button>

      <div className="relative" ref={shareRef}>
        <button
          onClick={onShare}
          aria-label="Share this article"
          className={`${pill} border-ink-700/70 text-slate-300 hover:border-brand-500/30 hover:text-brand-200`}
        >
          <Share2 className="h-4 w-4" /> Share
        </button>

        {shareOpen && (
          <div className="absolute left-0 top-full z-10 mt-2 w-44 overflow-hidden rounded-xl border border-ink-700/70 bg-ink-900 p-1 shadow-xl shadow-black/40">
            <a href={intents().x} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-ink-700/60 hover:text-white">
              <Twitter className="h-4 w-4" /> Share on X
            </a>
            <a href={intents().facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-ink-700/60 hover:text-white">
              <Facebook className="h-4 w-4" /> Facebook
            </a>
            <a href={intents().linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-ink-700/60 hover:text-white">
              <Linkedin className="h-4 w-4" /> LinkedIn
            </a>
            <button onClick={copyLink} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-ink-700/60 hover:text-white">
              {copied ? <Check className="h-4 w-4 text-success-400" /> : <Link2 className="h-4 w-4" />}
              {copied ? "Link copied" : "Copy link"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
