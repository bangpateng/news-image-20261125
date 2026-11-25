// news-image-20261125 — "The World in One Day"
// From-scratch renderer: draws a front-page collage of Wednesday 25 November
// 2026 world news into a 1024x1024 PNG. Node standard library only, no
// network, fully deterministic (fixed layout, fixed zlib level, no time or
// randomness), so repeated runs are byte-identical.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- palette
const PAPER: RGB = [246, 241, 231];
const INK: RGB = [20, 20, 20];
const NAVY: RGB = [22, 35, 63];
const RED: RGB = [180, 35, 24];
const GOLD: RGB = [233, 180, 76];
const TEAL: RGB = [14, 124, 123];
const WHITE: RGB = [255, 255, 255];
const PANEL_LINE: RGB = [216, 210, 196];
const GREY: RGB = [90, 86, 78];

type RGB = [number, number, number];

// ---------------------------------------------------------------- canvas
const px = new Uint8Array(W * H * 3);
function fill(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}
function setPixel(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) setPixel(i, j, c);
}
function hline(x0: number, x1: number, y: number, c: RGB): void {
  for (let x = x0; x <= x1; x++) setPixel(x, y, c);
}
function vline(x: number, y0: number, y1: number, c: RGB): void {
  for (let y = y0; y <= y1; y++) setPixel(x, y, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPixel(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
function thickLine(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  for (let a = -((t / 2) | 0); a <= (t / 2) | 0; a++)
    for (let b = -((t / 2) | 0); b <= (t / 2) | 0; b++)
      line(x0 + a, y0 + b, x1 + a, y1 + b, c);
}
function circle(cx: number, cy: number, r: number, c: RGB, filled: boolean): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (filled ? d2 <= r * r : d2 <= r * r && d2 >= (r - 2) * (r - 2)) setPixel(x, y, c);
    }
  }
}
function triangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.min(x0, x1, x2);
  const maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const s = (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0);
      const t = (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1);
      const u = (x0 - x2) * (y - y2) - (x - x2) * (y0 - y2);
      if ((area >= 0 && s >= 0 && t >= 0 && u >= 0) || (area < 0 && s <= 0 && t <= 0 && u <= 0))
        setPixel(x, y, c);
    }
  }
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows of 5 bits, written as strings. Designed here from scratch.
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "=": ["00000", "00000", "01110", "00000", "01110", "00000", "00000"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
};
const BLANK = ["00000", "00000", "00000", "00000", "00000", "00000", "00000"];

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}
function drawChar(ch: string, x: number, y: number, scale: number, c: RGB): void {
  // Font is uppercase-only by design; fold lowercase input to uppercase.
  const g = GLYPHS[ch.toUpperCase()] ?? BLANK;
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r][col] === "1") rect(x + col * scale, y + r * scale, scale, scale, c);
    }
  }
}
function drawText(s: string, x: number, y: number, scale: number, c: RGB): void {
  for (let i = 0; i < s.length; i++) drawChar(s[i], x + i * 6 * scale, y, scale, c);
}
function drawTextCentered(s: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}
// Greedy word wrap into lines of at most maxW pixels.
function wrap(s: string, scale: number, maxW: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, scale) <= maxW || cur === "") cur = trial;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- pictograms
// Each draws a simple icon inside a square box (bx, by, size s) in colour c.
function picTower(bx: number, by: number, s: number, c: RGB): void {
  const u = s / 64;
  rect(Math.round(bx + 26 * u), Math.round(by + 4 * u), Math.round(12 * u), Math.round(56 * u), c);
  rect(Math.round(bx + 18 * u), Math.round(by + 20 * u), Math.round(28 * u), Math.round(40 * u), c);
  rect(Math.round(bx + 10 * u), Math.round(by + 38 * u), Math.round(44 * u), Math.round(22 * u), c);
  vline(Math.round(bx + 32 * u), Math.round(by + 0 * u), Math.round(by + 6 * u), c);
  circle(Math.round(bx + 32 * u), Math.round(by + 2 * u), Math.round(3 * u), GOLD, true);
}
function picVerdict(bx: number, by: number, s: number, c: RGB): void {
  const u = s / 64;
  // Court document with a red seal: clearer at small size than a gavel.
  rect(Math.round(bx + 14 * u), Math.round(by + 6 * u), Math.round(32 * u), Math.round(46 * u), WHITE);
  rect(Math.round(bx + 14 * u), Math.round(by + 6 * u), Math.round(32 * u), Math.round(46 * u), c);
  rect(Math.round(bx + 17 * u), Math.round(by + 9 * u), Math.round(26 * u), Math.round(40 * u), WHITE);
  hline(Math.round(bx + 20 * u), Math.round(bx + 40 * u), Math.round(by + 16 * u), c);
  hline(Math.round(bx + 20 * u), Math.round(bx + 40 * u), Math.round(by + 22 * u), c);
  hline(Math.round(bx + 20 * u), Math.round(bx + 34 * u), Math.round(by + 28 * u), c);
  circle(Math.round(bx + 44 * u), Math.round(by + 44 * u), Math.round(9 * u), RED, true);
  circle(Math.round(bx + 44 * u), Math.round(by + 44 * u), Math.round(4 * u), WHITE, true);
}
function picShip(bx: number, by: number, s: number, c: RGB): void {
  const u = s / 64;
  triangle(Math.round(bx + 8 * u), Math.round(by + 40 * u), Math.round(bx + 56 * u), Math.round(by + 40 * u), Math.round(bx + 48 * u), Math.round(by + 56 * u), c);
  triangle(Math.round(bx + 8 * u), Math.round(by + 40 * u), Math.round(bx + 16 * u), Math.round(by + 56 * u), Math.round(bx + 48 * u), Math.round(by + 56 * u), c);
  vline(Math.round(bx + 32 * u), Math.round(by + 8 * u), Math.round(by + 40 * u), c);
  triangle(Math.round(bx + 32 * u), Math.round(by + 8 * u), Math.round(bx + 50 * u), Math.round(by + 18 * u), Math.round(bx + 32 * u), Math.round(by + 22 * u), c);
  hline(Math.round(bx + 4 * u), Math.round(bx + 60 * u), Math.round(by + 60 * u), c);
}
function picChart(bx: number, by: number, s: number, c: RGB): void {
  const u = s / 64;
  vline(Math.round(bx + 8 * u), Math.round(by + 6 * u), Math.round(by + 56 * u), c);
  hline(Math.round(bx + 8 * u), Math.round(bx + 58 * u), Math.round(by + 56 * u), c);
  const bars = [44, 34, 38, 22, 12];
  for (let i = 0; i < bars.length; i++) {
    rect(Math.round(bx + (14 + i * 9) * u), Math.round(by + (56 - bars[i]) * u), Math.round(6 * u), Math.round(bars[i] * u), i === bars.length - 1 ? RED : c);
  }
  thickLine(Math.round(bx + 12 * u), Math.round(by + 14 * u), Math.round(bx + 56 * u), Math.round(by + 44 * u), Math.max(2, Math.round(3 * u)), RED);
}
function picRocket(bx: number, by: number, s: number, c: RGB): void {
  const u = s / 64;
  triangle(Math.round(bx + 32 * u), Math.round(by + 2 * u), Math.round(bx + 22 * u), Math.round(by + 26 * u), Math.round(bx + 42 * u), Math.round(by + 26 * u), c);
  rect(Math.round(bx + 22 * u), Math.round(by + 24 * u), Math.round(20 * u), Math.round(22 * u), c);
  circle(Math.round(bx + 32 * u), Math.round(by + 32 * u), Math.round(5 * u), WHITE, true);
  triangle(Math.round(bx + 22 * u), Math.round(by + 36 * u), Math.round(bx + 12 * u), Math.round(by + 50 * u), Math.round(bx + 22 * u), Math.round(by + 46 * u), c);
  triangle(Math.round(bx + 42 * u), Math.round(by + 36 * u), Math.round(bx + 52 * u), Math.round(by + 50 * u), Math.round(bx + 42 * u), Math.round(by + 46 * u), c);
  triangle(Math.round(bx + 32 * u), Math.round(by + 46 * u), Math.round(bx + 26 * u), Math.round(by + 58 * u), Math.round(bx + 38 * u), Math.round(by + 58 * u), GOLD);
}
function picChip(bx: number, by: number, s: number, c: RGB): void {
  const u = s / 64;
  rect(Math.round(bx + 16 * u), Math.round(by + 16 * u), Math.round(32 * u), Math.round(32 * u), c);
  rect(Math.round(bx + 26 * u), Math.round(by + 26 * u), Math.round(12 * u), Math.round(12 * u), PAPER);
  for (let i = 0; i < 4; i++) {
    const p = 20 + i * 8;
    rect(Math.round(bx + p * u), Math.round(by + 6 * u), Math.round(4 * u), Math.round(10 * u), c);
    rect(Math.round(bx + p * u), Math.round(by + 48 * u), Math.round(4 * u), Math.round(10 * u), c);
    rect(Math.round(bx + 6 * u), Math.round(by + p * u), Math.round(10 * u), Math.round(4 * u), c);
    rect(Math.round(bx + 48 * u), Math.round(by + p * u), Math.round(10 * u), Math.round(4 * u), c);
  }
}
function picTarget(bx: number, by: number, s: number, c: RGB): void {
  const u = s / 64;
  circle(Math.round(bx + 32 * u), Math.round(by + 32 * u), Math.round(24 * u), c, false);
  circle(Math.round(bx + 32 * u), Math.round(by + 32 * u), Math.round(14 * u), c, false);
  circle(Math.round(bx + 32 * u), Math.round(by + 32 * u), Math.round(5 * u), RED, true);
  hline(Math.round(bx + 4 * u), Math.round(bx + 60 * u), Math.round(by + 32 * u), c);
  vline(Math.round(bx + 32 * u), Math.round(by + 4 * u), Math.round(by + 60 * u), c);
}
function picMountain(bx: number, by: number, s: number, c: RGB): void {
  const u = s / 64;
  triangle(Math.round(bx + 4 * u), Math.round(by + 56 * u), Math.round(bx + 28 * u), Math.round(by + 12 * u), Math.round(bx + 52 * u), Math.round(by + 56 * u), c);
  triangle(Math.round(bx + 28 * u), Math.round(by + 12 * u), Math.round(bx + 34 * u), Math.round(by + 24 * u), Math.round(bx + 22 * u), Math.round(by + 24 * u), WHITE);
  triangle(Math.round(bx + 34 * u), Math.round(by + 56 * u), Math.round(bx + 50 * u), Math.round(by + 26 * u), Math.round(bx + 60 * u), Math.round(by + 56 * u), TEAL);
  hline(Math.round(bx + 2 * u), Math.round(bx + 62 * u), Math.round(by + 58 * u), c);
}
function picVirus(bx: number, by: number, s: number, c: RGB): void {
  const u = s / 64;
  const cx = Math.round(bx + 32 * u);
  const cy = Math.round(by + 32 * u);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    line(cx, cy, Math.round(cx + Math.cos(a) * 28 * u), Math.round(cy + Math.sin(a) * 28 * u), c);
    circle(Math.round(cx + Math.cos(a) * 28 * u), Math.round(cy + Math.sin(a) * 28 * u), Math.max(2, Math.round(3 * u)), c, true);
  }
  circle(cx, cy, Math.round(16 * u), c, true);
  circle(Math.round(cx - 6 * u), Math.round(cy - 5 * u), Math.max(2, Math.round(3 * u)), WHITE, true);
  circle(Math.round(cx + 6 * u), Math.round(cy + 5 * u), Math.max(2, Math.round(3 * u)), WHITE, true);
}
function picMedal(bx: number, by: number, s: number, c: RGB): void {
  const u = s / 64;
  triangle(Math.round(bx + 22 * u), Math.round(by + 6 * u), Math.round(bx + 42 * u), Math.round(by + 6 * u), Math.round(bx + 32 * u), Math.round(by + 30 * u), RED);
  triangle(Math.round(bx + 22 * u), Math.round(by + 6 * u), Math.round(bx + 32 * u), Math.round(by + 30 * u), Math.round(bx + 14 * u), Math.round(by + 30 * u), TEAL);
  circle(Math.round(bx + 32 * u), Math.round(by + 42 * u), Math.round(16 * u), GOLD, true);
  circle(Math.round(bx + 32 * u), Math.round(by + 42 * u), Math.round(16 * u), c, false);
  circle(Math.round(bx + 32 * u), Math.round(by + 42 * u), Math.max(2, Math.round(4 * u)), c, true);
}
function picHack(bx: number, by: number, s: number, c: RGB): void {
  const u = s / 64;
  rect(Math.round(bx + 8 * u), Math.round(by + 10 * u), Math.round(48 * u), Math.round(34 * u), c);
  rect(Math.round(bx + 12 * u), Math.round(by + 14 * u), Math.round(40 * u), Math.round(26 * u), NAVY);
  // lightning bolt inside the screen
  triangle(Math.round(bx + 34 * u), Math.round(by + 16 * u), Math.round(bx + 24 * u), Math.round(by + 32 * u), Math.round(bx + 32 * u), Math.round(by + 32 * u), GOLD);
  triangle(Math.round(bx + 32 * u), Math.round(by + 28 * u), Math.round(bx + 40 * u), Math.round(by + 28 * u), Math.round(bx + 28 * u), Math.round(by + 40 * u), GOLD);
  rect(Math.round(bx + 26 * u), Math.round(by + 44 * u), Math.round(12 * u), Math.round(6 * u), c);
  rect(Math.round(bx + 16 * u), Math.round(by + 50 * u), Math.round(32 * u), Math.round(5 * u), c);
}

// ---------------------------------------------------------------- stories
type Story = {
  kicker: string;
  headline: string;
  summary: string;
  pic: (bx: number, by: number, s: number, c: RGB) => void;
  accent: RGB;
};
const STORIES: Story[] = [
  { kicker: "MIDDLE EAST", headline: "HOUTHIS STRIKE RIYADH'S PIF TOWER", summary: "11 wounded in second hit in under a week.", pic: picTower, accent: RED },
  { kicker: "TECH / COURTS", headline: "HUAWEI GUILTY OF STEALING TRADE SECRETS", summary: "US jury convicts on 10 of 12 counts.", pic: picVerdict, accent: NAVY },
  { kicker: "WAR IN UKRAINE", headline: "UKRAINE HITS RUSSIAN SHIP IN GULF OF FINLAND", summary: "Kyiv says it also sank a warship off Libya.", pic: picShip, accent: TEAL },
  { kicker: "MARKETS", headline: "NASDAQ -1.5% AS NVIDIA -6%", summary: "Chip stocks fall 8% on new tariff threat.", pic: picChart, accent: RED },
  { kicker: "SPACE", headline: "PAKISTAN'S FIRST ASTRONAUT BLASTS OFF", summary: "Shenzhou-24 lifts off to Tiangong station.", pic: picRocket, accent: NAVY },
  { kicker: "MIDDLE EAST", headline: "ISRAELI STRIKE KILLS HAMAS SECURITY CHIEF", summary: "Naeem Abu Nahel killed in Gaza, officials say.", pic: picTarget, accent: RED },
  { kicker: "ASIA", headline: "QUAKE OF 5.6 SHAKES NEPAL", summary: "Near the Tibet border; tremor felt widely.", pic: picMountain, accent: TEAL },
  { kicker: "HEALTH", headline: "WHO PULLS EBOLA TEAMS FROM DR CONGO FIGHTING", summary: "Outbreak toll reaches 5,775 dead.", pic: picVirus, accent: NAVY },
  { kicker: "WASHINGTON", headline: "TRUMP HONOURS GIULIANI", summary: "Medal of Freedom; turkey pardon.", pic: picMedal, accent: GOLD },
];

// ---------------------------------------------------------------- layout
function drawMasthead(): void {
  // Layout guard: masthead lines must fit the canvas width.
  if (textWidth("THE WORLD IN ONE DAY", 5) > W) throw new Error("masthead title overflows");
  if (textWidth("WEDNESDAY 25 NOVEMBER 2026", 3) > W) throw new Error("masthead date overflows");
  rect(0, 0, W, 150, NAVY);
  rect(0, 150, W, 6, RED);
  drawTextCentered("THE WORLD IN ONE DAY", 512, 26, 5, WHITE);
  drawTextCentered("WEDNESDAY 25 NOVEMBER 2026", 512, 96, 3, GOLD);
  hline(212, 812, 84, GOLD);
}

function drawLead(): void {
  const x = 12;
  const y = 166;
  const w = 1000;
  const h = 170;
  rect(x, y, w, h, WHITE);
  rect(x, y, 10, h, RED);
  // border
  rect(x, y, w, 2, PANEL_LINE);
  rect(x, y + h - 2, w, 2, PANEL_LINE);
  rect(x, y, 2, h, PANEL_LINE);
  rect(x + w - 2, y, 2, h, PANEL_LINE);
  picHack(x + 28, y + 30, 110, INK);
  const tx = x + 168;
  drawText("LEAD STORY - CYBERATTACK", tx, y + 18, 2, RED);
  const head = wrap("CIA AND ODNI HIT BY CYBERATTACK", 3, 1000 - 168 - 28);
  if (head.length > 2) throw new Error(`lead headline wraps to ${head.length} lines, panel fits 2`);
  head.forEach((ln, i) => drawText(ln, tx, y + 46 + i * 26, 3, INK));
  const sum = wrap("Unclassified systems breached, CNN reported 25 Nov. US spy agencies probe the intrusion.", 2, 1000 - 168 - 28);
  if (sum.length > 2) throw new Error(`lead summary wraps to ${sum.length} lines, panel fits 2`);
  sum.forEach((ln, i) => drawText(ln, tx, y + 108 + i * 18, 2, GREY));
}

function drawPanel(s: Story, x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, WHITE);
  rect(x, y, w, 6, s.accent);
  rect(x, y, w, 2, PANEL_LINE);
  rect(x, y + h - 2, w, 2, PANEL_LINE);
  rect(x, y, 2, h, PANEL_LINE);
  rect(x + w - 2, y, 2, h, PANEL_LINE);
  drawText(s.kicker, x + 14, y + 16, 2, s.accent);
  s.pic(x + 14, y + 44, 64, s.accent === GOLD ? NAVY : s.accent);
  const head = wrap(s.headline, 2, w - 92 - 14);
  if (head.length > 3) throw new Error(`headline wraps to ${head.length} lines, panel fits 3: ${s.headline}`);
  head.slice(0, 3).forEach((ln, i) => drawText(ln, x + 92, y + 48 + i * 18, 2, INK));
  const sum = wrap(s.summary, 2, w - 28);
  if (sum.length > 2) throw new Error(`summary wraps to ${sum.length} lines, panel fits 2: ${s.summary}`);
  sum.slice(0, 2).forEach((ln, i) => drawText(ln, x + 14, y + 132 + i * 18, 2, GREY));
}

function drawGrid(): void {
  const cols = 3;
  const rows = 3;
  const pw = 322;
  const ph = 206;
  const gap = 11;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      drawPanel(STORIES[idx], 12 + c * (pw + gap), 348 + r * (ph + gap), pw, ph);
    }
  }
}

function drawFooter(): void {
  rect(0, 996, W, 28, NAVY);
  drawTextCentered("ALSO: AIDS DEATHS AT 20-YEAR LOW - BOAT CAPSIZES OFF SENEGAL", 512, 1003, 2, GOLD);
}

function render(): void {
  fill(PAPER);
  drawMasthead();
  drawLead();
  drawGrid();
  drawFooter();
}

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}
function encodePng(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
}

// Re-read the written file and verify it round-trips exactly: PNG signature,
// IHDR dimensions, every chunk CRC, and byte-equality with the buffer we
// encoded. Throws on any mismatch so a bad write can never pass silently.
function validateWrittenPng(expected: Buffer, filePath: string): void {
  const onDisk = fs.readFileSync(filePath);
  if (!onDisk.equals(expected)) throw new Error("written PNG bytes differ from encoded buffer");
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!onDisk.subarray(0, 8).equals(sig)) throw new Error("written file lacks PNG signature");
  let off = 8;
  let sawIEND = false;
  while (off < onDisk.length) {
    if (off + 12 > onDisk.length) throw new Error("truncated PNG chunk header");
    const len = onDisk.readUInt32BE(off);
    const type = onDisk.toString("ascii", off + 4, off + 8);
    if (off + 12 + len > onDisk.length) throw new Error(`truncated PNG chunk ${type}`);
    const data = onDisk.subarray(off + 8, off + 8 + len);
    const storedCrc = onDisk.readUInt32BE(off + 8 + len);
    const actualCrc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
    if (storedCrc !== actualCrc) throw new Error(`PNG chunk ${type} CRC mismatch`);
    if (type === "IHDR") {
      if (len !== 13) throw new Error("IHDR has wrong length");
      if (data.readUInt32BE(0) !== W || data.readUInt32BE(4) !== H)
        throw new Error(`IHDR dimensions ${data.readUInt32BE(0)}x${data.readUInt32BE(4)}, expected ${W}x${H}`);
    }
    if (type === "IEND") {
      sawIEND = true;
      off += 12 + len;
      break; // anything after IEND is trailing bytes, caught by the check below
    }
    off += 12 + len;
  }
  if (!sawIEND) throw new Error("PNG missing IEND chunk");
  if (off !== onDisk.length) throw new Error("trailing bytes after PNG IEND chunk");
}

// ---------------------------------------------------------------- main
function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output"; // empty env falls back to /output
  fs.mkdirSync(outDir, { recursive: true });
  render();
  const png = encodePng();
  if (png.length > 1048576) throw new Error(`PNG too large: ${png.length} bytes`);
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, png);
  validateWrittenPng(png, outPath);
  console.log(`Wrote ${outPath} (${png.length} bytes, ${W}x${H})`);
}

main();
