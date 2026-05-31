"use client";

import { useState, useCallback, type ImgHTMLAttributes } from "react";

type ImageState = "loading" | "loaded" | "error";

/**
 * Lesson image component with quality gate:
 * - Shows a subtle skeleton placeholder during load
 * - On error, shows a muted fallback (not just hidden)
 * - Renders caption with source domain when alt text is present
 */
export function LessonImage({
  src,
  alt,
  className,
  ...rest
}: ImgHTMLAttributes<HTMLImageElement>) {
  const [state, setState] = useState<ImageState>("loading");

  const onLoad = useCallback(() => setState("loaded"), []);
  const onError = useCallback(() => setState("error"), []);

  if (!src) return null;

  // Extract domain for source credit
  let sourceDomain = "";
  if (typeof src === "string") {
    try {
      sourceDomain = new URL(src).hostname.replace(/^www\./, "");
    } catch {
      // Invalid URL — nothing to show
    }
  }

  return (
    <span className="block my-6 overflow-hidden rounded-xl border border-[#efe9e2] shadow-sm">
      {/* Loading skeleton */}
      {state === "loading" && (
        <div className="flex h-48 items-center justify-center bg-[#f8f6f4] animate-pulse">
          <svg
            className="h-8 w-8 text-[#d4c9bd]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
            />
          </svg>
        </div>
      )}

      {/* Actual image — hidden behind skeleton until loaded */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={`w-full h-auto object-cover ${state === "loading" ? "hidden" : ""} ${className ?? ""}`}
        loading="lazy"
        onLoad={onLoad}
        onError={onError}
        {...rest}
      />

      {/* Error fallback */}
      {state === "error" && (
        <div className="flex h-28 items-center justify-center gap-2 bg-[#fdf3f1] px-4">
          <svg
            className="h-4 w-4 shrink-0 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
            />
          </svg>
          <span className="text-xs text-red-400 italic">Image unavailable</span>
        </div>
      )}

      {/* Caption with alt text + source domain */}
      {(alt || sourceDomain) && state !== "error" && (
        <span className="flex flex-wrap items-center gap-x-2 bg-[#fcfaf8] px-4 py-2 text-[11px] font-medium text-[var(--color-text-muted)] border-t border-[#efe9e2]">
          {alt && <span className="italic">{alt}</span>}
          {alt && sourceDomain && (
            <span className="text-[10px] text-[#c4b8ab]" aria-hidden="true">·</span>
          )}
          {sourceDomain && (
            <span className="font-normal tracking-wide uppercase">
              via {sourceDomain}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
