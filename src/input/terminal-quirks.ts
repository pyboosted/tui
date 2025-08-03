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

import { TerminalType } from './features.ts';
import type { KeyCode, KeyModifiers } from './types.ts';

/**
 * Terminal key code remapping for non-standard terminals
 * Maps actual received codes to what they should represent
 */
export const TERMINAL_KEY_REMAP: Record<
  TerminalType,
  Record<number, string>
> = {
  [TerminalType.ITerm]: {
    // iTerm specific remappings
    57442: 'Control', // Sends Right Shift code for Left Ctrl
    57443: 'Alt', // Sends Left Ctrl code for Left Alt
    57444: 'Meta', // Sends Right Ctrl code for Left Cmd
    57447: 'Shift', // Sends Left Meta code for Right Shift
    57449: 'Alt', // Sends CapsLock code for Right Alt
    57450: 'Meta', // Sends NumLock code for Right Cmd
  },
  [TerminalType.Tmux]: {
    // Tmux may have different quirks
  },
  [TerminalType.SSH]: {
    // SSH sessions may have limited key support
  },
  [TerminalType.Unknown]: {
    // Generic quirks for unknown terminals
    57442: 'Control',
    57443: 'Alt',
    57444: 'Meta',
  },
  // Modern terminals don't need remapping
  [TerminalType.Kitty]: {},
  [TerminalType.Ghostty]: {},
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
  // \x01 (1) is sent for Cmd+Left in iTerm
  // 1: { key: 'Left', meta: true },
  // \x05 (5) is sent for Cmd+Right in iTerm
  // 5: { key: 'Right', meta: true },
};

/**
 * Cached terminal type for quirk detection
 */
let cachedTerminalType: TerminalType | null = null;

/**
 * Get the terminal type for quirk application
 */
function getTerminalType(): TerminalType {
  if (cachedTerminalType) {
    return cachedTerminalType;
  }

  const term = process.env.TERM || '';
  const termProgram = process.env.TERM_PROGRAM || '';

  if (termProgram.toLowerCase() === 'kitty' || term.includes('kitty')) {
    cachedTerminalType = TerminalType.Kitty;
  } else if (
    termProgram.toLowerCase() === 'ghostty' ||
    term.includes('ghostty')
  ) {
    cachedTerminalType = TerminalType.Ghostty;
  } else if (termProgram.toLowerCase() === 'iterm.app') {
    cachedTerminalType = TerminalType.ITerm;
  } else if (process.env.TMUX) {
    cachedTerminalType = TerminalType.Tmux;
  } else {
    cachedTerminalType = TerminalType.Unknown;
  }

  return cachedTerminalType;
}

/**
 * Check if we need to apply terminal-specific remapping
 */
export function shouldApplyQuirks(terminalType?: TerminalType): boolean {
  const type = terminalType || getTerminalType();

  // Modern terminals like Kitty and Ghostty don't need quirks
  if (type === TerminalType.Kitty || type === TerminalType.Ghostty) {
    return false;
  }

  // Apply quirks for iTerm, tmux, and unknown terminals
  return true;
}

/**
 * Remap a key code if needed
 */
export function remapKeyCode(
  unicode: number,
  originalKey: string,
  terminalType?: TerminalType
): string {
  const type = terminalType || getTerminalType();

  if (!shouldApplyQuirks(type)) {
    return originalKey;
  }

  const remapTable = TERMINAL_KEY_REMAP[type];
  if (remapTable?.[unicode]) {
    return remapTable[unicode];
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
  const type = getTerminalType();
  // Only apply Meta remapping for specific terminals where this quirk exists
  if (type === TerminalType.ITerm && META_CONTROL_CHAR_REMAP[byte]) {
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

/**
 * Clear cached terminal type (for testing)
 */
export function clearTerminalTypeCache(): void {
  cachedTerminalType = null;
}
