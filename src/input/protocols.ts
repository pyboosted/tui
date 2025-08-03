/**
 * Terminal protocol constants and escape sequence mappings
 *
 * This module contains the various escape sequence mappings for different
 * terminal protocols including CSI, SS3, and control characters.
 */

import type { KeyCode } from './types.ts';

/**
 * Control character mappings (ASCII < 32)
 */
export const CTRL_CHARS: Record<number, KeyCode> = {
  0: { char: '\0' }, // Null
  1: { char: 'a' }, // Ctrl+A
  2: { char: 'b' }, // Ctrl+B
  3: { char: 'c' }, // Ctrl+C
  4: { char: 'd' }, // Ctrl+D
  5: { char: 'e' }, // Ctrl+E
  6: { char: 'f' }, // Ctrl+F
  7: { char: 'g' }, // Ctrl+G (Bell)
  8: { char: 'h' }, // Ctrl+H (Backspace on some terminals)
  9: 'Tab', // Tab key (indistinguishable from Ctrl+I in raw mode)
  10: { char: 'j' }, // Ctrl+J (Line Feed)
  11: { char: 'k' }, // Ctrl+K
  12: { char: 'l' }, // Ctrl+L
  13: 'Enter', // Enter key (indistinguishable from Ctrl+M in raw mode)
  14: { char: 'n' }, // Ctrl+N
  15: { char: 'o' }, // Ctrl+O
  16: { char: 'p' }, // Ctrl+P
  17: { char: 'q' }, // Ctrl+Q
  18: { char: 'r' }, // Ctrl+R
  19: { char: 's' }, // Ctrl+S
  20: { char: 't' }, // Ctrl+T
  21: { char: 'u' }, // Ctrl+U
  22: { char: 'v' }, // Ctrl+V
  23: { char: 'w' }, // Ctrl+W
  24: { char: 'x' }, // Ctrl+X
  25: { char: 'y' }, // Ctrl+Y
  26: { char: 'z' }, // Ctrl+Z
  27: 'Escape', // ESC
  127: 'Backspace', // DEL
};

/**
 * CSI sequence mappings (ESC [ ...)
 */
export const CSI_KEY_MAP: Record<string, KeyCode> = {
  // Cursor keys
  A: 'Up',
  B: 'Down',
  C: 'Right',
  D: 'Left',

  // Navigation keys
  H: 'Home',
  F: 'End',
  '1~': 'Home',
  '2~': 'Insert',
  '3~': 'Delete',
  '4~': 'End',
  '5~': 'PageUp',
  '6~': 'PageDown',
  '7~': 'Home',
  '8~': 'End',

  // Function keys
  '11~': 'F1',
  '12~': 'F2',
  '13~': 'F3',
  '14~': 'F4',
  '15~': 'F5',
  '17~': 'F6',
  '18~': 'F7',
  '19~': 'F8',
  '20~': 'F9',
  '21~': 'F10',
  '23~': 'F11',
  '24~': 'F12',

  // Modified function keys (xterm)
  '1;2P': 'F1', // Shift+F1
  '1;2Q': 'F2', // Shift+F2
  '1;2R': 'F3', // Shift+F3
  '1;2S': 'F4', // Shift+F4
};

/**
 * SS3 sequence mappings (ESC O ...)
 */
export const SS3_KEY_MAP: Record<string, KeyCode> = {
  // Function keys (older terminals)
  P: 'F1',
  Q: 'F2',
  R: 'F3',
  S: 'F4',

  // Arrow keys (application mode)
  A: 'Up',
  B: 'Down',
  C: 'Right',
  D: 'Left',

  // Keypad keys
  H: 'Home',
  F: 'End',
};

/**
 * Mouse button mappings for SGR protocol
 */
export const SGR_BUTTON_MAP = {
  0: 1, // Left button
  1: 3, // Middle button
  2: 2, // Right button
  64: 'WheelUp',
  65: 'WheelDown',
  66: 'WheelLeft',
  67: 'WheelRight',
} as const;

/**
 * Modifier bit masks for mouse events
 */
export const MOUSE_MODIFIER_MASK = {
  SHIFT: 0x04,
  ALT: 0x08,
  CTRL: 0x10,
  META: 0x20,
} as const;

/**
 * Kitty keyboard protocol flags
 */
export const KITTY_FLAGS = {
  DISAMBIGUATE_ESCAPES: 0x01,
  REPORT_EVENT_TYPES: 0x02,
  REPORT_ALTERNATE_KEYS: 0x04,
  REPORT_ALL_KEYS_AS_ESCAPE_CODES: 0x08,
  REPORT_ASSOCIATED_TEXT: 0x10,
} as const;

/**
 * Kitty event types
 */
export const KITTY_EVENT_TYPE = {
  RELEASE: 0,
  PRESS: 1,
  REPEAT: 2,
} as const;

/**
 * Common escape sequences for terminal control
 */
export const ESCAPE_SEQUENCES = {
  // Mouse tracking
  ENABLE_MOUSE_TRACKING: '\x1b[?1000h',
  DISABLE_MOUSE_TRACKING: '\x1b[?1000l',
  ENABLE_MOUSE_BUTTONS: '\x1b[?1002h',
  DISABLE_MOUSE_BUTTONS: '\x1b[?1002l',
  ENABLE_MOUSE_ALL: '\x1b[?1003h',
  DISABLE_MOUSE_ALL: '\x1b[?1003l',
  ENABLE_SGR_MOUSE: '\x1b[?1006h',
  DISABLE_SGR_MOUSE: '\x1b[?1006l',

  // Bracketed paste
  ENABLE_BRACKETED_PASTE: '\x1b[?2004h',
  DISABLE_BRACKETED_PASTE: '\x1b[?2004l',
  PASTE_START: '\x1b[200~',
  PASTE_END: '\x1b[201~',

  // Focus events
  ENABLE_FOCUS_EVENTS: '\x1b[?1004h',
  DISABLE_FOCUS_EVENTS: '\x1b[?1004l',
  FOCUS_IN: '\x1b[I',
  FOCUS_OUT: '\x1b[O',

  // Kitty keyboard protocol
  PUSH_KITTY_KEYBOARD: (flags: number) => `\x1b[>${flags}u`,
  POP_KITTY_KEYBOARD: '\x1b[<u',

  // Screen manipulation
  SAVE_CURSOR: '\x1b7',
  RESTORE_CURSOR: '\x1b8',
  SAVE_SCREEN: '\x1b[?47h',
  RESTORE_SCREEN: '\x1b[?47l',
  ALTERNATE_SCREEN: '\x1b[?1049h',
  PRIMARY_SCREEN: '\x1b[?1049l',
} as const;

/**
 * Maximum parameter value for CSI sequences
 */
export const MAX_CSI_PARAM = 0xff_ff_ff; // Increased for Kitty keyboard protocol which uses values > 57000

/**
 * Maximum number of parameters in a CSI sequence
 */
export const MAX_CSI_PARAMS = 16;

/**
 * Buffer size for partial sequence accumulation
 */
export const SEQUENCE_BUFFER_SIZE = 256;
