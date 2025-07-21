import type { Cell, Color } from './types.ts';

// Enhanced cell structure with inline color support
// We'll use two 32-bit values per cell:
// Cell1 (32-bit): [8-bit attr | 21-bit codepoint | 3-bit reserved]
// Cell2 (32-bit): [16-bit fg color | 16-bit bg color]
//
// For 16-bit color encoding:
// - 0x0000: no color (inherit)
// - 0x0001-0x0100: palette colors (256 colors)
// - 0x0101-0xFFFF: RGB colors (5-6-5 bit encoding)

// Color encoding helpers
const COLOR_NONE = 0x00_00;
const COLOR_PALETTE_START = 0x00_01;
const COLOR_RGB_START = 0x01_01;

const CHAR_MASK = 0x1f_ff_ff; // 21 bits for character
const ATTR_SHIFT = 24; // Attribute starts at bit 24

// Regex for hex color matching
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/;

// RGB color packing (5-6-5 bit encoding)
function packRgbColor(r: number, g: number, b: number): number {
  // 5 bits red, 6 bits green, 5 bits blue
  const r5 = (r >> 3) & 0x1f;
  const g6 = (g >> 2) & 0x3f;
  const b5 = (b >> 3) & 0x1f;
  return COLOR_RGB_START + (r5 << 11) + (g6 << 5) + b5;
}

function unpackRgbColor(packed: number): [number, number, number] {
  const rgb = packed - COLOR_RGB_START;
  const r5 = (rgb >> 11) & 0x1f;
  const g6 = (rgb >> 5) & 0x3f;
  const b5 = rgb & 0x1f;
  // Convert back to 8-bit values
  const r = (r5 << 3) | (r5 >> 2);
  const g = (g6 << 2) | (g6 >> 4);
  const b = (b5 << 3) | (b5 >> 2);
  return [r, g, b];
}

/**
 * Encode a color into 16-bit format
 */
export function encodeColor(color?: Color): number {
  if (!color) {
    return COLOR_NONE;
  }

  if (typeof color === 'number') {
    // Palette color (0-255)
    return COLOR_PALETTE_START + (color & 0xff);
  }

  // RGB hex color
  const match = color.match(HEX_COLOR_REGEX);
  if (!match?.[1]) {
    return COLOR_NONE;
  }

  const rgb = Number.parseInt(match[1], 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = rgb & 0xff;

  return packRgbColor(r, g, b);
}

/**
 * Decode a 16-bit color back to Color type
 */
export function decodeColor(encoded: number): Color | undefined {
  if (encoded === COLOR_NONE) {
    return;
  }

  if (encoded <= COLOR_PALETTE_START + 255) {
    // Palette color
    return encoded - COLOR_PALETTE_START;
  }

  // RGB color
  const [r, g, b] = unpackRgbColor(encoded);
  const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  return `#${hex}` as Color;
}

/**
 * Pack a character, attributes, and colors into a Cell
 */
export function packCell(
  char: string,
  attr = 0,
  fgColor?: Color,
  bgColor?: Color
): Cell {
  // Cell 1: character and attributes (same as before)
  const codePoint = char ? char.codePointAt(0) || 0x20 : 0x20;
  const cell1 = ((attr & 0xff) << ATTR_SHIFT) | (codePoint & CHAR_MASK);

  // Cell 2: colors
  const fg = encodeColor(fgColor);
  const bg = encodeColor(bgColor);
  const cell2 = (fg << 16) | bg;

  return [cell1, cell2];
}

/**
 * Create an empty cell
 */
export function emptyCell(): Cell {
  return [packCellPart(' ', 0), 0];
}

/**
 * Pack cell with attributes helper
 */
function packCellPart(char: string, attr = 0): number {
  const codePoint = char ? char.codePointAt(0) || 0x20 : 0x20;
  return ((attr & 0xff) << ATTR_SHIFT) | (codePoint & CHAR_MASK);
}

/**
 * Extract character from Cell
 */
export function unpackChar(cell: Cell): string {
  const codePoint = cell[0] & CHAR_MASK;
  return String.fromCodePoint(codePoint);
}

/**
 * Extract attribute byte from Cell
 */
export function unpackAttr(cell: Cell): number {
  return (cell[0] >>> ATTR_SHIFT) & 0xff;
}

/**
 * Extract foreground color from Cell
 */
export function unpackFgColor(cell: Cell): Color | undefined {
  const fg = (cell[1] >>> 16) & 0xff_ff;
  return decodeColor(fg);
}

/**
 * Extract background color from Cell
 */
export function unpackBgColor(cell: Cell): Color | undefined {
  const bg = cell[1] & 0xff_ff;
  return decodeColor(bg);
}

/**
 * Check if two Cells are equal
 */
export function cellEquals(a: Cell, b: Cell): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/**
 * Clear a cell buffer with empty cells
 */
export function clearCells(buffer: Cell[], start = 0, end?: number): void {
  const empty = emptyCell();
  const limit = end ?? buffer.length;
  for (let i = start; i < limit; i++) {
    buffer[i] = empty;
  }
}
