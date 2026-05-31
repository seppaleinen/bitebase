"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export type Section = {
  id: string;
  label: string;
};

/**
 * Parse `##` headings from markdown into { id, label } pairs.
 * The `id` is a URL-safe slug used for anchor links and IntersectionObserver.
 */
export function parseSections(markdown: string): Section[] {
  if (!markdown) return [];
  const sections: Section[] = [];
  const regex = /^##\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    const raw = match[1].trim();
    // Strip emoji and trim for the label
    const label = raw.replace(/[\u{1F000}-\u{1FFFF}]/gu, "").trim();
    if (!label) continue;
    const id = slugify(raw);
    sections.push({ id, label });
  }
  return sections;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "") // strip emoji
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "section";
}

/**
 * Sticky section navigator.
 * Shows a compact "On this page" bar with clickable links to each `##` section.
 * The currently visible section is highlighted via IntersectionObserver.
 * Only renders when there are 3+ sections.
 */
export function SectionNavigator({
  sections,
  containerId,
}: {
  sections: Section[];
  containerId?: string;
}) {
  const [activeId, setActiveId] = useState<string>("");
  const headingsRef = useRef<Map<string, IntersectionObserverEntry>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      headingsRef.current.set(entry.target.id, entry);
    }

    // Find the first heading that's above the top of the viewport
    // (meaning we've scrolled past it), or the first visible one
    let maxTop = -Infinity;
    let maxTopId = "";

    for (const [id, e] of headingsRef.current) {
      if (e.isIntersecting || e.boundingClientRect.top < 200) {
        if (e.boundingClientRect.top > maxTop) {
          maxTop = e.boundingClientRect.top;
          maxTopId = id;
        }
      }
    }

    if (maxTopId) setActiveId(maxTopId);
  }, []);

  useEffect(() => {
    if (sections.length < 3) return;

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: "-80px 0px -60% 0px",
      threshold: 0,
    });
    observerRef.current = observer;

    // Wait for DOM to render, then observe all h2 elements
    const timer = setTimeout(() => {
      const container = containerId
        ? document.getElementById(containerId)
        : document;

      if (!container) return;

      for (const section of sections) {
        const el = container.querySelector(`#${CSS.escape(section.id)}`);
        if (el) observer.observe(el);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [sections, containerId, handleIntersect]);

  if (sections.length < 3) return null;

  function handleClick(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <nav
      aria-label="Section navigation"
      className="mb-0 flex flex-wrap items-center gap-x-1 gap-y-1 rounded-xl border border-[#efe9e2] bg-[var(--color-card)] px-4 py-2.5 shadow-sm text-sm"
    >
      <span className="mr-1 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        On this page
      </span>
      {sections.map((s, i) => (
        <span key={s.id} className="flex items-center">
          {i > 0 && (
            <span className="mx-1 text-[10px] text-[#d4c9bd]" aria-hidden="true">
              ·
            </span>
          )}
          <button
            type="button"
            onClick={() => handleClick(s.id)}
            className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs transition-colors ${
              activeId === s.id
                ? "bg-violet-100 font-semibold text-violet-700"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
            }`}
          >
            {s.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
