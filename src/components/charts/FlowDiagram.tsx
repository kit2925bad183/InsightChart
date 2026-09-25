"use client";

import { useId, useState } from "react";
import type { FlowLink } from "@/lib/analysis/aggregate";
import { categoricalVar, tierColorVar } from "@/lib/palette";

const TIER_COLOR: Record<string, string> = {
  Strong: tierColorVar.strong,
  Developing: tierColorVar.developing,
  "Needs support": tierColorVar.support,
};

export function FlowDiagram({
  left,
  right,
  links,
  onSelectLink,
}: {
  left: string[];
  right: string[];
  links: FlowLink[];
  onSelectLink?: (link: FlowLink) => void;
}) {
  const id = useId();
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 640;
  const height = Math.max(220, Math.max(left.length, right.length) * 44 + 24);
  const nodeW = 128;
  const leftX = 12;
  const rightX = width - nodeW - 12;

  const columnY = (i: number, count: number) => {
    if (count <= 1) return height / 2 - 12;
    return 24 + i * ((height - 48 - 24) / (count - 1));
  };
  const leftY = (i: number) => columnY(i, left.length);
  const rightY = (i: number) => columnY(i, right.length);

  const maxValue = Math.max(1, ...links.map((l) => l.value));

  return (
    <div className="overflow-x-auto">
      <svg
        role="img"
        aria-label="Flow diagram showing how many students in each department fall into each performance tier"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[560px]"
      >
        {links.map((link, i) => {
          const si = left.indexOf(link.source);
          const ti = right.indexOf(link.target);
          const y1 = leftY(si) + 12;
          const y2 = rightY(ti) + 12;
          const x1 = leftX + nodeW;
          const x2 = rightX;
          const strokeWidth = 1.5 + (link.value / maxValue) * 10;
          const midX = (x1 + x2) / 2;
          const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
          const active = hovered === i;
          return (
            <g key={i}>
              <path
                d={path}
                fill="none"
                stroke={TIER_COLOR[link.target]}
                strokeOpacity={active ? 0.85 : 0.35}
                strokeWidth={strokeWidth}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelectLink?.(link)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelectLink?.(link)}
                role={onSelectLink ? "button" : undefined}
                tabIndex={0}
                aria-label={`${link.source} to ${link.target}: ${link.value} students`}
                style={{ cursor: "pointer", transition: "stroke-opacity 0.15s" }}
              />
              {active && (
                <text x={midX} y={(y1 + y2) / 2 - 8} textAnchor="middle" fontSize={11} fill="var(--text-primary)" fontWeight={600}>
                  {link.value}
                </text>
              )}
            </g>
          );
        })}

        {left.map((l, i) => (
          <g key={`${id}-l-${l}`} transform={`translate(${leftX}, ${leftY(i)})`}>
            <rect width={nodeW} height={24} rx={6} fill={categoricalVar[i % categoricalVar.length]} />
            <text x={nodeW / 2} y={16} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff">
              {l}
            </text>
          </g>
        ))}

        {right.map((r, i) => (
          <g key={`${id}-r-${r}`} transform={`translate(${rightX}, ${rightY(i)})`}>
            <rect width={nodeW} height={24} rx={6} fill={TIER_COLOR[r]} />
            <text x={nodeW / 2} y={16} textAnchor="middle" fontSize={11} fontWeight={600} fill="#fff">
              {r}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
