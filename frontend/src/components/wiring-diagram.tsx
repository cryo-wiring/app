"use client";

import { useState, useMemo } from "react";
import type { CooldownBundle, ResolvedLine, ResolvedComponent } from "@/types/cooldown";

const STAGES = ["RT", "50K", "4K", "Still", "CP", "MXC"] as const;

const STAGE_FILLS = [
  "rgba(239,68,68,0.06)",   // RT - red
  "rgba(249,115,22,0.06)",  // 50K - orange
  "rgba(234,179,8,0.06)",   // 4K - yellow
  "rgba(16,185,129,0.06)",  // Still - emerald
  "rgba(6,182,212,0.06)",   // CP - cyan
  "rgba(59,130,246,0.06)",  // MXC - blue
];
const STAGE_BORDERS = [
  "rgba(239,68,68,0.2)",
  "rgba(249,115,22,0.2)",
  "rgba(234,179,8,0.2)",
  "rgba(16,185,129,0.2)",
  "rgba(6,182,212,0.2)",
  "rgba(59,130,246,0.2)",
];
const STAGE_TEXT = [
  "#f87171", "#fb923c", "#fbbf24", "#34d399", "#22d3ee", "#60a5fa",
];

const COMP_W = 52;
const COMP_H = 16;
const COMP_PITCH = 38;
const LINE_SPACING = 120;
const LABEL_MARGIN = 60;
const BAND_PAD_H = 30;
const HEADER_HEIGHT = 55;
const MIN_BAND_HEIGHT = 45;
const BAND_PAD_V = 20;
const DUT_HEIGHT = 36;
const DUT_GAP = 12;
const ARROW_SIZE = 8;

type LineEntry = {
  line: ResolvedLine;
  style: "solid" | "dashed" | "dashdot";
  direction: "down" | "up";
  section: string;
};

function compLabel(c: ResolvedComponent): string {
  if (c.type === "attenuator" && c.value_dB != null) return `${c.value_dB} dB`;
  if (c.type === "filter") return c.filter_type?.toLowerCase().startsWith("ecco") ? "Ecco." : (c.filter_type?.slice(0, 5) || "FLT");
  if (c.type === "isolator") return "ISO";
  if (c.type === "amplifier" && c.gain_dB != null) return `+${c.gain_dB} dB`;
  return c.model.slice(0, 8);
}

function pickRepresentative(lines: ResolvedLine[]): ResolvedLine[] {
  const flagged = lines.filter((l) => l.representative);
  if (flagged.length > 0) return flagged;
  return lines.length > 0 ? [lines[0]] : [];
}

function maxCompsPerStage(lines: LineEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of STAGES) counts[s] = 0;
  for (const { line } of lines) {
    for (const s of STAGES) {
      const n = (line.stages[s] ?? []).length;
      if (n > counts[s]) counts[s] = n;
    }
  }
  return counts;
}

function computeBandLayout(lines: LineEntry[]) {
  const maxComp = maxCompsPerStage(lines);
  const heights: Record<string, number> = {};
  for (const s of STAGES) {
    const n = maxComp[s];
    heights[s] = n === 0 ? MIN_BAND_HEIGHT : Math.max(MIN_BAND_HEIGHT, n * COMP_PITCH + 2 * BAND_PAD_V);
  }
  const yCenters: Record<string, number> = {};
  let cursor = 0;
  for (const s of STAGES) {
    const h = heights[s];
    yCenters[s] = cursor + h / 2;
    cursor += h;
  }
  return { yCenters, heights };
}

type Props = {
  data: CooldownBundle;
};

export function WiringDiagram({ data }: Props) {
  const [mode, setMode] = useState<"representative" | "full">("representative");

  const lineEntries = useMemo(() => {
    const entries: LineEntry[] = [];
    const ctrlLines = mode === "representative" ? pickRepresentative(data.control.lines) : data.control.lines;
    const rsLines = mode === "representative" ? pickRepresentative(data.readout_send.lines) : data.readout_send.lines;
    const rrLines = mode === "representative" ? pickRepresentative(data.readout_return.lines) : data.readout_return.lines;
    for (const l of ctrlLines) entries.push({ line: l, style: "solid", direction: "down", section: "Control" });
    for (const l of rsLines) entries.push({ line: l, style: "dashed", direction: "down", section: "Readout Send" });
    for (const l of rrLines) entries.push({ line: l, style: "dashdot", direction: "up", section: "Readout Return" });
    return entries;
  }, [data, mode]);

  const layout = useMemo(() => {
    if (lineEntries.length === 0) return null;
    const { yCenters, heights } = computeBandLayout(lineEntries);
    const n = lineEntries.length;
    const xFirst = LABEL_MARGIN + COMP_W + BAND_PAD_H;
    const xLast = xFirst + (n - 1) * LINE_SPACING;
    const bandLeft = xFirst - COMP_W - BAND_PAD_H;
    const bandRight = xLast + COMP_W + BAND_PAD_H;

    let totalBandH = 0;
    for (const s of STAGES) totalBandH += heights[s];
    const mxcBottom = totalBandH;

    const svgW = bandRight + 20;
    const svgH = HEADER_HEIGHT + totalBandH + DUT_GAP + DUT_HEIGHT + 16;

    return { yCenters, heights, xFirst, bandLeft, bandRight, mxcBottom, svgW, svgH, n };
  }, [lineEntries]);

  if (!layout || lineEntries.length === 0) return null;
  const { yCenters, heights, xFirst, bandLeft, bandRight, mxcBottom, svgW, svgH } = layout;

  const lineColor = "#94a3b8";
  const textColor = "#cbd5e1";
  const dimColor = "#475569";

  return (
    <div className="card mb-6 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-cryo-500/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-sm font-semibold text-cryo-100 tracking-wide">Wiring Diagram</h3>
        <div className="flex gap-0.5 bg-cryo-900/50 rounded-lg p-0.5 border border-cryo-500/30 self-start sm:self-auto">
          {(["representative", "full"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 sm:px-3 py-1.5 text-xs rounded-md transition-all ${
                mode === m
                  ? "bg-accent/15 text-accent font-medium border border-accent/20"
                  : "text-cryo-300 hover:text-cryo-100 border border-transparent"
              }`}
            >
              {m === "representative" ? "Rep." : "Full"}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 overflow-x-auto bg-cryo-900/40">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width={svgW}
          style={{ minWidth: svgW, display: "block", margin: "0 auto" }}
          className="select-none"
        >
          {/* Pulse animation defs */}
          <defs>
            {/* Control (solid) - blue */}
            <radialGradient id="pulse-core-ctrl" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#93c5fd" stopOpacity="1" />
              <stop offset="60%" stopColor="#60a5fa" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="pulse-tail-ctrl-down" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="pulse-tail-ctrl-up" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.5" />
            </linearGradient>
            {/* Readout Send (dashed) - violet */}
            <radialGradient id="pulse-core-rs" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#c4b5fd" stopOpacity="1" />
              <stop offset="60%" stopColor="#a78bfa" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="pulse-tail-rs-down" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity="0" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.5" />
            </linearGradient>
            {/* Readout Return (dashdot) - emerald */}
            <radialGradient id="pulse-core-rr" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#6ee7b7" stopOpacity="1" />
              <stop offset="60%" stopColor="#34d399" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="pulse-tail-rr-up" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.5" />
            </linearGradient>
            {/* Glow filter */}
            <filter id="pulse-blur" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
            </filter>
          </defs>

          {/* Stage bands */}
          {STAGES.map((stage, i) => {
            const yTop = HEADER_HEIGHT + yCenters[stage] - heights[stage] / 2;
            const h = heights[stage];
            return (
              <g key={stage}>
                <rect
                  x={bandLeft}
                  y={yTop}
                  width={bandRight - bandLeft}
                  height={h}
                  fill={STAGE_FILLS[i]}
                  stroke={STAGE_BORDERS[i]}
                  strokeWidth="0.5"
                />
                <text
                  x={bandLeft - 8}
                  y={yTop + h / 2}
                  textAnchor="end"
                  dominantBaseline="central"
                  fill={STAGE_TEXT[i]}
                  fontSize="11"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight="600"
                >
                  {stage}
                </text>
              </g>
            );
          })}

          {/* DUT box */}
          {(() => {
            const dutTop = HEADER_HEIGHT + mxcBottom + DUT_GAP;
            return (
              <g>
                <rect
                  x={bandLeft}
                  y={dutTop}
                  width={bandRight - bandLeft}
                  height={DUT_HEIGHT}
                  fill="rgba(59,130,246,0.08)"
                  stroke="rgba(59,130,246,0.3)"
                  strokeWidth="0.5"
                  rx="4"
                />
                <text
                  x={(bandLeft + bandRight) / 2}
                  y={dutTop + DUT_HEIGHT / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#60a5fa"
                  fontSize="12"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight="700"
                >
                  DUT
                </text>
              </g>
            );
          })()}

          {/* Lines */}
          {lineEntries.map((entry, i) => {
            const x = xFirst + i * LINE_SPACING;
            const { line, style, direction } = entry;

            const labelLine1 = line.line_id;
            const labelLine2 = line.qubit
              ? `(${line.qubit})`
              : line.qubits
                ? `(${line.qubits[0]}..${line.qubits[line.qubits.length - 1]})`
                : "";

            const strokeDash =
              style === "dashed" ? "6,3" : style === "dashdot" ? "6,3,2,3" : undefined;

            const yTop = HEADER_HEIGHT + yCenters[STAGES[0]] - heights[STAGES[0]] / 2;
            const yBottom = HEADER_HEIGHT + mxcBottom;
            const dutTop = yBottom + DUT_GAP;

            return (
              <g key={line.line_id + i}>
                {/* Header label */}
                <text
                  x={x}
                  y={HEADER_HEIGHT - 24}
                  textAnchor="middle"
                  fill={textColor}
                  fontSize="10"
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight="600"
                >
                  {labelLine1}
                </text>
                {labelLine2 && (
                  <text
                    x={x}
                    y={HEADER_HEIGHT - 10}
                    textAnchor="middle"
                    fill={dimColor}
                    fontSize="9"
                    fontFamily="'DM Sans', sans-serif"
                  >
                    {labelLine2}
                  </text>
                )}

                {/* Vertical wire */}
                <line
                  x1={x} y1={yTop} x2={x} y2={yBottom}
                  stroke={lineColor}
                  strokeWidth="1"
                  strokeDasharray={strokeDash}
                  strokeLinecap="round"
                />

                {/* Connector to DUT */}
                <line
                  x1={x} y1={yBottom} x2={x} y2={dutTop}
                  stroke={lineColor}
                  strokeWidth="1"
                  strokeLinecap="round"
                />

                {/* Pulse animation */}
                {(() => {
                  const isUp = direction === "up";
                  const sectionKey = style === "solid" ? "ctrl" : style === "dashed" ? "rs" : "rr";
                  const coreId = `pulse-core-${sectionKey}`;
                  const tailId = `pulse-tail-${sectionKey}-${isUp ? "up" : "down"}`;
                  const dur = 5;
                  const tailLen = 18;

                  return [0, 1, 2].map((dot) => {
                    const delay = dot * (dur / 3);
                    const yFrom = isUp ? yBottom : yTop;
                    const yTo = isUp ? yTop : yBottom;
                    return (
                      <g key={`pulse-${dot}`}>
                        {/* Tail */}
                        <rect width="1.5" height={tailLen} rx="0.75" fill={`url(#${tailId})`}>
                          <animate
                            attributeName="x"
                            values={`${x - 0.75};${x - 0.75}`}
                            dur={`${dur}s`}
                            begin={`${delay}s`}
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="y"
                            values={isUp ? `${yFrom};${yTo - tailLen}` : `${yFrom - tailLen};${yTo - tailLen}`}
                            dur={`${dur}s`}
                            begin={`${delay}s`}
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="opacity"
                            values="0;0.6;0.6;0"
                            keyTimes="0;0.08;0.88;1"
                            dur={`${dur}s`}
                            begin={`${delay}s`}
                            repeatCount="indefinite"
                          />
                        </rect>
                        {/* Outer glow */}
                        <circle cx={x} r="5" fill={`url(#${coreId})`} filter="url(#pulse-blur)">
                          <animate
                            attributeName="cy"
                            values={`${yFrom};${yTo}`}
                            dur={`${dur}s`}
                            begin={`${delay}s`}
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="opacity"
                            values="0;0.5;0.5;0"
                            keyTimes="0;0.08;0.88;1"
                            dur={`${dur}s`}
                            begin={`${delay}s`}
                            repeatCount="indefinite"
                          />
                        </circle>
                        {/* Core dot */}
                        <circle cx={x} r="2" fill={`url(#${coreId})`}>
                          <animate
                            attributeName="cy"
                            values={`${yFrom};${yTo}`}
                            dur={`${dur}s`}
                            begin={`${delay}s`}
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="opacity"
                            values="0;1;1;0"
                            keyTimes="0;0.08;0.88;1"
                            dur={`${dur}s`}
                            begin={`${delay}s`}
                            repeatCount="indefinite"
                          />
                        </circle>
                      </g>
                    );
                  });
                })()}

                {/* Stage dots + components */}
                {STAGES.map((stage) => {
                  const cy = HEADER_HEIGHT + yCenters[stage];
                  const comps = line.stages[stage] ?? [];
                  return (
                    <g key={stage}>
                      <circle cx={x} cy={cy} r="2" fill={lineColor} />
                      {comps.map((c, j) => {
                        const compY =
                          comps.length > 1
                            ? cy + (j - (comps.length - 1) / 2) * COMP_PITCH
                            : cy;
                        return (
                          <g key={j}>
                            <rect
                              x={x - COMP_W}
                              y={compY - COMP_H}
                              width={COMP_W * 2}
                              height={COMP_H * 2}
                              fill="rgba(30,41,59,0.9)"
                              stroke={lineColor}
                              strokeWidth="0.5"
                              rx="3"
                            />
                            <text
                              x={x}
                              y={compY}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fill={textColor}
                              fontSize="10"
                              fontFamily="'JetBrains Mono', monospace"
                            >
                              {compLabel(c)}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })}

                {/* Direction arrow */}
                {(() => {
                  if (direction === "up") {
                    const sA = STAGES[STAGES.length - 2];
                    const sB = STAGES[STAGES.length - 1];
                    const midY = HEADER_HEIGHT + (yCenters[sA] + yCenters[sB]) / 2;
                    const tipY = midY - ARROW_SIZE;
                    return (
                      <polygon
                        points={`${x},${tipY} ${x - 5},${tipY + 10} ${x + 5},${tipY + 10}`}
                        fill={lineColor}
                      />
                    );
                  }
                  const s1 = STAGES[0];
                  const s2 = STAGES[1];
                  const midY = HEADER_HEIGHT + (yCenters[s1] + yCenters[s2]) / 2;
                  const tipY = midY + ARROW_SIZE;
                  return (
                    <polygon
                      points={`${x},${tipY} ${x - 5},${tipY - 10} ${x + 5},${tipY - 10}`}
                      fill={lineColor}
                    />
                  );
                })()}
              </g>
            );
          })}

          {/* Legend */}
          {(() => {
            const styles = new Set(lineEntries.map((e) => e.style));
            if (styles.size <= 1) return null;
            const legendItems: { label: string; dash?: string }[] = [];
            if (styles.has("solid")) legendItems.push({ label: "Control" });
            if (styles.has("dashed")) legendItems.push({ label: "Readout Send", dash: "6,3" });
            if (styles.has("dashdot")) legendItems.push({ label: "Readout Return", dash: "6,3,2,3" });

            const lx = bandRight - 130;
            const ly = HEADER_HEIGHT + mxcBottom + DUT_GAP + DUT_HEIGHT + 4;

            return (
              <g>
                {legendItems.map((item, i) => (
                  <g key={item.label}>
                    <line
                      x1={lx}
                      y1={ly + i * 14 + 4}
                      x2={lx + 24}
                      y2={ly + i * 14 + 4}
                      stroke={lineColor}
                      strokeWidth="1"
                      strokeDasharray={item.dash}
                    />
                    <text
                      x={lx + 30}
                      y={ly + i * 14 + 4}
                      dominantBaseline="central"
                      fill={dimColor}
                      fontSize="9"
                      fontFamily="'DM Sans', sans-serif"
                    >
                      {item.label}
                    </text>
                  </g>
                ))}
              </g>
            );
          })()}
        </svg>
      </div>
    </div>
  );
}
