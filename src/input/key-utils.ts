/**
 * Utilities for working with keyboard input
 */

import type { KeyEvent } from './types.ts';

/**
 * Common shifted character mappings (US keyboard layout)
 */
const SHIFTED_CHARS: Record<string, string> = {
  '!': '1',
  '@': '2',
  '#': '3',
  $: '4',
  '%': '5',
  '^': '6',
  '&': '7',
  '*': '8',
  '(': '9',
  ')': '0',
  _: '-',
  '+': '=',
  '{': '[',
  '}': ']',
  '|': '\\',
  ':': ';',
  '"': "'",
  '<': ',',
  '>': '.',
  '?': '/',
  '~': '`',
};

/**
 * Check if a character appears to be shifted (uppercase or special char)
 */
export function isShiftedChar(char: string): boolean {
  if (char.length !== 1) {
    return false;
  }

  // Uppercase letters
  if (char >= 'A' && char <= 'Z') {
    return true;
  }

  // Common shifted symbols
  if (char in SHIFTED_CHARS) {
    return true;
  }

  return false;
}

/**
 * Get the unshifted version of a character
 */
export function getUnshiftedChar(char: string): string | null {
  if (char.length !== 1) {
    return null;
  }

  // Uppercase to lowercase
  if (char >= 'A' && char <= 'Z') {
    return char.toLowerCase();
  }

  // Shifted symbols
  return SHIFTED_CHARS[char] || null;
}

/**
 * Normalize a key event to include implicit shift modifier
 * This adds the shift modifier for uppercase letters and shifted symbols
 * when not already present
 */
export function normalizeShiftModifier(event: KeyEvent): KeyEvent {
  // Only process character keys without existing shift modifier
  if (
    event.type !== 'key' ||
    typeof event.code !== 'object' ||
    event.modifiers.shift ||
    !event.code.char
  ) {
    return event;
  }

  const char = event.code.char;
  if (isShiftedChar(char)) {
    // Create a new event with shift modifier added
    return {
      ...event,
      modifiers: {
        ...event.modifiers,
        shift: true,
      },
    };
  }

  return event;
}

/**
 * Normalize a key event to show the base key + modifiers
 * For example: 'A' → 'a' + Shift, '!' → '1' + Shift
 *
 * Note: This uses US keyboard layout for symbol mapping
 */
export function normalizeToBaseKey(event: KeyEvent): KeyEvent {
  // Only process character keys
  if (
    event.type !== 'key' ||
    typeof event.code !== 'object' ||
    !event.code.char
  ) {
    return event;
  }

  const char = event.code.char;
  const unshifted = getUnshiftedChar(char);

  if (unshifted && !event.modifiers.shift) {
    // Create a new event with base key and shift modifier
    return {
      ...event,
      code: { char: unshifted },
      modifiers: {
        ...event.modifiers,
        shift: true,
      },
    };
  }

  return event;
}

/**
 * Compare two key events for equality, considering implicit shift
 */
export function areKeysEqual(a: KeyEvent, b: KeyEvent): boolean {
  // Normalize both events
  const normA = normalizeShiftModifier(a);
  const normB = normalizeShiftModifier(b);

  // Compare codes
  const codeA = typeof normA.code === 'object' ? normA.code.char : normA.code;
  const codeB = typeof normB.code === 'object' ? normB.code.char : normB.code;

  if (codeA !== codeB) {
    return false;
  }

  // Compare modifiers
  return (
    normA.modifiers.ctrl === normB.modifiers.ctrl &&
    normA.modifiers.alt === normB.modifiers.alt &&
    normA.modifiers.shift === normB.modifiers.shift &&
    normA.modifiers.meta === normB.modifiers.meta
  );
}
