"use client";

import { useRef, useState, type KeyboardEvent } from "react";

/** Arrow-key roving-tabindex helper for the desktop sidebar nav list — no roving-tablist
 * component exists elsewhere in this codebase, so this mirrors Combobox.tsx's keydown
 * switch rather than inventing a new interaction pattern. */
export function useRovingIndex(count: number) {
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  const registerRef = (i: number) => (el: HTMLElement | null) => {
    itemRefs.current[i] = el;
  };

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    let next: number | null = null;
    if (e.key === "ArrowDown") next = (index + 1) % count;
    else if (e.key === "ArrowUp") next = (index - 1 + count) % count;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = count - 1;
    if (next === null) return;
    e.preventDefault();
    setActiveIndex(next);
    itemRefs.current[next]?.focus();
  };

  return { activeIndex, setActiveIndex, registerRef, onKeyDown };
}
