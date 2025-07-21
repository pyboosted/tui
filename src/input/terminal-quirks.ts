/**
 * Terminal-specific quirks and workarounds
 *
 * Some terminals send non-standard key codes that need to be remapped
 *
 * Known quirks:
 * 1. Modifier keys send wrong Unicode values (e.g., Left Ctrl sends Right Shift code)
 * 2. Meta+navigation keys send control characters instead of Kitty sequences
 * 3. Alt+arrow keys send escape sequences instead of Kitty sequences
 * 4. Ctrl+Escape and Meta+Escape only send release events, not press events
 */

import type { KeyCode, KeyModifiers } from './types.ts';

/**
 * Terminal key code remapping for non-standard terminals
 * Maps actual received codes to what they should represent
 */
export const TERMINAL_KEY_REMAP: Record<number, string> = {
  // Your terminal's quirky mappings
  57442: 'Control', // Sends Right Shift code for Left Ctrl
  57443: 'Alt', // Sends Left Ctrl code for Left Alt
  57444: 'Meta', // Sends Right Ctrl code for Left Cmd
  57447: 'Shift', // Sends Left Meta code for Right Shift
  57449: 'Alt', // Sends CapsLock code for Right Alt
  57450: 'Meta', // Sends NumLock code for Right Cmd
};

/**
 * Control character remapping for Meta key combinations
 * Maps control chars that are sent instead of proper Meta+key sequences
 */
export const META_CONTROL_CHAR_REMAP: Record<
  number,
  { key: string; meta: boolean }
> = {
  // \x15 (21) is sent for Meta+Backspace on some terminals
  21: { key: 'Backspace', meta: true },
  // \x01 (1) is sent for Cmd+Left
  1: { key: 'Left', meta: true },
  // \x05 (5) is sent for Cmd+Right
  5: { key: 'Right', meta: true },
};

/**
 * Check if we need to apply terminal-specific remapping
 */
export function shouldApplyQuirks(): boolean {
  // Could check TERM_PROGRAM or other env vars
  // For now, always apply if mappings are needed
  return true;
}

/**
 * Remap a key code if needed
 */
export function remapKeyCode(unicode: number, originalKey: string): string {
  if (shouldApplyQuirks() && TERMINAL_KEY_REMAP[unicode]) {
    return TERMINAL_KEY_REMAP[unicode];
  }
  return originalKey;
}

/**
 * Alt key escape sequences that should be remapped
 * Maps escape + char sequences to Alt+key combinations
 */
export const ALT_ESCAPE_CHAR_REMAP: Record<string, string> = {
  // ESC b is sent for Alt+Left
  b: 'Left',
  // ESC f is sent for Alt+Right
  f: 'Right',
};

/**
 * Check if a control character should be remapped to Meta+key
 */
export function remapControlChar(
  byte: number
): { key: KeyCode; modifiers: Partial<KeyModifiers> } | null {
  if (shouldApplyQuirks() && META_CONTROL_CHAR_REMAP[byte]) {
    const remap = META_CONTROL_CHAR_REMAP[byte];
    return {
      key: remap.key as KeyCode,
      modifiers: { meta: remap.meta },
    };
  }
  return null;
}

/**
 * Check if an escape+char sequence should be remapped to Alt+key
 */
export function remapAltEscapeChar(char: string): string | null {
  if (shouldApplyQuirks() && ALT_ESCAPE_CHAR_REMAP[char]) {
    return ALT_ESCAPE_CHAR_REMAP[char];
  }
  return null;
}
