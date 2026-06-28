import React, { useMemo } from 'react';

/**
 * Deterministic Urbit-style glyph avatar.
 * Generates a unique black-and-white geometric sigil from any string seed (uid, email, etc.).
 * Each seed always produces the same glyph.
 */

// ── Hash function ─────────────────────────────────────────────────────────────
function hashSeed(seed: string): number[] {
  // Simple deterministic hash → 16 numbers 0-255
  let h = 0x811c9dc5;
  const bytes: number[] = [];
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  for (let i = 0; i < 16; i++) {
    h ^= (h >>> 13);
    h = Math.imul(h, 0x5bd1e995);
    h ^= (h >>> 15);
    bytes.push(Math.abs(h + i * 7919) % 256);
  }
  return bytes;
}

// ── Geometric primitives ──────────────────────────────────────────────────────

type ShapeRenderer = (cx: number, cy: number, size: number, rot: number) => string;

const shapes: ShapeRenderer[] = [
  // 0: Diamond
  (cx, cy, s, rot) => {
    const pts = [[0, -s], [s, 0], [0, s], [-s, 0]].map(([x, y]) => rotate(x, y, rot));
    return `<polygon points="${pts.map(([x, y]) => `${cx + x},${cy + y}`).join(' ')}" />`;
  },
  // 1: Triangle up
  (cx, cy, s, rot) => {
    const pts = [[0, -s], [s * 0.87, s * 0.5], [-s * 0.87, s * 0.5]].map(([x, y]) => rotate(x, y, rot));
    return `<polygon points="${pts.map(([x, y]) => `${cx + x},${cy + y}`).join(' ')}" />`;
  },
  // 2: Square
  (cx, cy, s, rot) => {
    const r = s * 0.75;
    const pts = [[-r, -r], [r, -r], [r, r], [-r, r]].map(([x, y]) => rotate(x, y, rot));
    return `<polygon points="${pts.map(([x, y]) => `${cx + x},${cy + y}`).join(' ')}" />`;
  },
  // 3: Circle
  (cx, cy, s) => `<circle cx="${cx}" cy="${cy}" r="${s * 0.65}" />`,
  // 4: Hexagon
  (cx, cy, s, rot) => {
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i + rot;
      return [Math.cos(a) * s * 0.75, Math.sin(a) * s * 0.75] as [number, number];
    });
    return `<polygon points="${pts.map(([x, y]) => `${cx + x},${cy + y}`).join(' ')}" />`;
  },
  // 5: Cross / plus
  (cx, cy, s, rot) => {
    const w = s * 0.28;
    const pts: [number, number][] = [
      [-w, -s * 0.75], [w, -s * 0.75], [w, -w], [s * 0.75, -w],
      [s * 0.75, w], [w, w], [w, s * 0.75], [-w, s * 0.75],
      [-w, w], [-s * 0.75, w], [-s * 0.75, -w], [-w, -w],
    ];
    const rPts = pts.map(([x, y]) => rotate(x, y, rot));
    return `<polygon points="${rPts.map(([x, y]) => `${cx + x},${cy + y}`).join(' ')}" />`;
  },
  // 6: Chevron / arrow
  (cx, cy, s, rot) => {
    const pts: [number, number][] = [
      [0, -s * 0.8], [s * 0.7, 0], [0, s * 0.35], [-s * 0.7, 0],
    ];
    const rPts = pts.map(([x, y]) => rotate(x, y, rot));
    return `<polygon points="${rPts.map(([x, y]) => `${cx + x},${cy + y}`).join(' ')}" />`;
  },
  // 7: Star / 4-point
  (cx, cy, s, rot) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i + rot;
      const r = i % 2 === 0 ? s * 0.8 : s * 0.35;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return `<polygon points="${pts.map(([x, y]) => `${cx + x},${cy + y}`).join(' ')}" />`;
  },
];

function rotate(x: number, y: number, angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x * c - y * s, x * s + y * c];
}

// ── Generate SVG ──────────────────────────────────────────────────────────────

function generateSigil(seed: string, size: number): string {
  const h = hashSeed(seed);
  const S = size;
  const half = S / 2;

  // Pick layout: 2x2 grid of shapes, mirrored for symmetry
  const bgFill = '#000';
  const fgFill = '#fff';

  // Select shapes and rotations from hash
  const s0 = shapes[h[0] % shapes.length];
  const s1 = shapes[h[1] % shapes.length];
  const s2 = shapes[h[2] % shapes.length];
  const s3 = shapes[h[3] % shapes.length];

  const rot0 = (h[4] / 255) * Math.PI * 2;
  const rot1 = (h[5] / 255) * Math.PI * 2;
  const rot2 = (h[6] / 255) * Math.PI * 2;
  const rot3 = (h[7] / 255) * Math.PI * 2;

  // Whether to use mirrored (symmetric) layout
  const symmetric = h[8] % 3 !== 0; // 66% chance of symmetry
  // Cell size
  const cellSize = S * 0.22;
  const q1 = S * 0.28;
  const q3 = S * 0.72;

  let inner = '';

  if (symmetric) {
    // Horizontally mirrored: left and right are the same
    inner += s0(q1, q1, cellSize, rot0);
    inner += s0(q3, q1, cellSize, -rot0); // mirror
    inner += s1(q1, q3, cellSize, rot1);
    inner += s1(q3, q3, cellSize, -rot1); // mirror
  } else {
    inner += s0(q1, q1, cellSize, rot0);
    inner += s1(q3, q1, cellSize, rot1);
    inner += s2(q1, q3, cellSize, rot2);
    inner += s3(q3, q3, cellSize, rot3);
  }

  // Optional center element (50% chance)
  if (h[9] % 2 === 0) {
    const centerShape = shapes[h[10] % shapes.length];
    const centerRot = (h[11] / 255) * Math.PI * 2;
    const centerSize = S * 0.15;
    inner += centerShape(half, half, centerSize, centerRot);
  }

  // Optional border ring
  const borderWidth = h[12] % 3 === 0 ? 2 : 0;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
    <rect width="${S}" height="${S}" fill="${bgFill}" rx="${S * 0.15}" />
    <g fill="${fgFill}" opacity="0.92">${inner}</g>
    ${borderWidth ? `<rect x="${borderWidth / 2}" y="${borderWidth / 2}" width="${S - borderWidth}" height="${S - borderWidth}" fill="none" stroke="${fgFill}" stroke-width="${borderWidth}" rx="${S * 0.15}" opacity="0.3" />` : ''}
  </svg>`;
}

// ── React Component ───────────────────────────────────────────────────────────

interface GlyphAvatarProps {
  seed: string;              // uid, email, or any unique string
  size?: number;             // pixel size (default 40)
  className?: string;        // additional CSS classes
  round?: boolean;           // clip to circle (default true)
}

export default function GlyphAvatar({ seed, size = 40, className = '', round = true }: GlyphAvatarProps) {
  const svgDataUrl = useMemo(() => {
    const svg = generateSigil(seed || 'default', 128);
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }, [seed]);

  return (
    <img
      src={svgDataUrl}
      alt="avatar"
      width={size}
      height={size}
      className={`${round ? 'rounded-full' : 'rounded-lg'} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
